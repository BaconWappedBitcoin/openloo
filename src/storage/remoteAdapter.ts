import type { AppData } from '../types'
import { sanitizeAppData } from '../lib/sanitize'
import { AuthRequiredError, StorageError, type AuthController, type StorageAdapter } from './adapter'

const TOKEN_KEY = 'openloo:sync-token'
const POLL_INTERVAL_MS = 8000

interface HealthResponse {
  ok: boolean
  sync: boolean
  authRequired: boolean
  needsSetup?: boolean
}

/**
 * Probe the backend. Resolves to its health payload, or `null` when there is
 * no sync backend (the GitHub Pages demo, or any static host) — in which case
 * the caller falls back to browser-local storage.
 */
export async function probeBackend(baseUrl = '/api'): Promise<HealthResponse | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    clearTimeout(timer)
    if (!response.ok) return null
    const body = (await response.json()) as HealthResponse
    return body.sync ? body : null
  } catch {
    return null
  }
}

/**
 * Talks to the OpenLoo sync server so a single dashboard follows the user
 * across devices and browsers.
 *
 * The server holds one document guarded by one passcode. This adapter keeps a
 * revision number alongside the data and sends it on every write; if the
 * server has moved on (another device saved first) the write comes back 409
 * and we adopt the server's copy rather than clobber it. Reads are always
 * re-sanitised — the stored document is only as trustworthy as whatever last
 * wrote it.
 */
export class RemoteStorageAdapter implements StorageAdapter {
  readonly name = 'Synced server'
  readonly auth: AuthController

  private token: string | null
  private revision = 0
  private externalChange: ((data: AppData) => void) | null = null
  private poll: ReturnType<typeof setInterval> | undefined
  // Saves are serialised through this chain so two PUTs are never in flight at
  // once — otherwise a second save would reuse the revision the first has not
  // yet bumped, and conflict with our own write.
  private saveChain: Promise<void> = Promise.resolve()
  private saving = false

  constructor(
    private readonly authRequired: boolean,
    private readonly baseUrl = '/api',
    needsSetup = false,
  ) {
    this.token = localStorage.getItem(TOKEN_KEY)

    this.auth = {
      required: authRequired,
      needsSetup,
      isAuthed: () => !authRequired || this.token !== null,
      login: (passcode) => this.login(passcode),
      setup: (passcode) => this.setup(passcode),
      logout: () => this.logout(),
    }
  }

  async load(): Promise<AppData | null> {
    const response = await this.request('GET', '/data')
    const body = (await response.json()) as { revision: number; data: unknown }
    this.revision = body.revision
    // `data` is null on a brand-new server; return null so the store seeds
    // fresh initial data, which the first edit will then push up.
    return body.data ? sanitizeAppData(body.data) : null
  }

  save(data: AppData): Promise<void> {
    // Queue behind any in-flight save so PUTs run strictly one at a time; each
    // then uses the revision the previous one returned. `.then(run, run)` keeps
    // the chain alive even if a prior save rejected.
    const run = () => this.doSave(data)
    this.saveChain = this.saveChain.then(run, run)
    return this.saveChain
  }

  private async doSave(data: AppData): Promise<void> {
    this.saving = true
    try {
      let response = await this.request('PUT', '/data', { revision: this.revision, data })

      if (response.status === 409) {
        // The server moved on. In the ordinary single-user case this is our own
        // earlier write catching up (a poll, or a previous save), so adopt the
        // server's revision and re-send our latest state once — last write wins.
        const body = (await response.json()) as { revision: number }
        this.revision = body.revision
        response = await this.request('PUT', '/data', { revision: this.revision, data })
      }

      if (response.status === 409) {
        // Still conflicting after a retry: another device is genuinely writing
        // right now. Take its version rather than clobber it, and say so.
        const body = (await response.json()) as { revision: number; data: unknown }
        this.revision = body.revision
        const merged = body.data ? sanitizeAppData(body.data) : null
        if (merged && this.externalChange) this.externalChange(merged)
        throw new StorageError(
          'This webmix was being edited on another device; the newer version was loaded.',
        )
      }

      const body = (await response.json()) as { revision: number }
      this.revision = body.revision
    } finally {
      this.saving = false
    }
  }

  async clear(): Promise<void> {
    // Reset the server document to empty; the store seeds fresh data on reload.
    await this.request('PUT', '/data', { revision: this.revision, data: null }).catch(() => {})
  }

  /** Poll the server's revision; when it advances, pull and apply the new data. */
  subscribe(onExternalChange: (data: AppData) => void): () => void {
    this.externalChange = onExternalChange

    this.poll = setInterval(() => {
      void this.checkForUpdates()
    }, POLL_INTERVAL_MS)

    return () => {
      if (this.poll) clearInterval(this.poll)
      this.externalChange = null
    }
  }

  private async checkForUpdates(): Promise<void> {
    // Do not poll while a save is in flight: the revision is mid-change, and a
    // reload here would fight our own write.
    if (this.saving) return
    try {
      const response = await this.request('GET', '/revision')
      const { revision } = (await response.json()) as { revision: number }
      if (revision === this.revision) return
      const data = await this.load()
      if (data && this.externalChange) this.externalChange(data)
    } catch {
      // A failed poll is not worth surfacing; the next tick retries.
    }
  }

  private async login(passcode: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    if (response.status === 429) {
      throw new StorageError('Too many attempts. Wait a few minutes and try again.')
    }
    if (!response.ok) return false
    this.storeToken((await response.json()) as { token: string })
    return true
  }

  /** First-run: create the passcode. The server logs us straight in on success. */
  private async setup(passcode: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passcode }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      throw new StorageError(body?.error ?? 'Could not create the passcode.')
    }
    this.storeToken((await response.json()) as { token: string })
    return true
  }

  private storeToken({ token }: { token: string }): void {
    this.token = token
    localStorage.setItem(TOKEN_KEY, token)
  }

  private async logout(): Promise<void> {
    const token = this.token
    this.token = null
    localStorage.removeItem(TOKEN_KEY)
    if (token) {
      await fetch(`${this.baseUrl}/session`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    if (this.authRequired && !this.token) throw new AuthRequiredError()

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (cause) {
      throw new StorageError('Could not reach the sync server.', cause)
    }

    if (response.status === 401) {
      // The token was rejected — expired or revoked. Force a fresh sign-in.
      this.token = null
      localStorage.removeItem(TOKEN_KEY)
      throw new AuthRequiredError()
    }

    // 409 is handled by the caller (save); anything else in the 4xx/5xx range
    // that is not a conflict is a genuine failure.
    if (!response.ok && response.status !== 409) {
      throw new StorageError(`Sync server returned ${response.status}.`)
    }

    return response
  }
}
