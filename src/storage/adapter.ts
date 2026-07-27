import type { AppData } from '../types'

/**
 * The only way the app talks to persistence.
 *
 * OpenLoo ships with a browser-local adapter and no server. Keeping every read
 * and write behind this interface means adding a real backend later is a new
 * file here plus a config switch — not a rewrite of the UI. Implementations
 * are async even when the local one resolves immediately, so a networked
 * adapter is a drop-in.
 */
export interface StorageAdapter {
  /** Human-readable name, shown in settings. */
  readonly name: string
  /** Returns `null` when nothing has been stored yet. */
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
  /**
   * Notify when another context (another tab, or a server push) changes the
   * data. Returns an unsubscribe function.
   */
  subscribe?(onExternalChange: (data: AppData) => void): () => void

  /** Present only on adapters that authenticate against a server. */
  readonly auth?: AuthController
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}

/**
 * Thrown by a remote adapter when the caller is not (or no longer) signed in.
 * The store treats this specially: it shows the passcode gate rather than
 * surfacing it as a generic error.
 */
export class AuthRequiredError extends StorageError {
  constructor(message = 'Sign in required.') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

/**
 * Optional auth surface for adapters that talk to a server. The local adapter
 * has no `auth`; a remote one exposes this so the store can drive a login gate
 * without knowing anything about how the backend authenticates.
 */
export interface AuthController {
  /** Whether the backend demands a passcode at all. */
  readonly required: boolean
  /** True when no passcode exists yet and one must be created (first run). */
  readonly needsSetup: boolean
  /** Whether a valid credential is currently held. */
  isAuthed(): boolean
  /** Exchange a passcode for a session; resolves true on success. */
  login(passcode: string): Promise<boolean>
  /** Create the instance passcode on first run; resolves true on success. */
  setup(passcode: string): Promise<boolean>
  logout(): Promise<void>
}
