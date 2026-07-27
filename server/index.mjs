/**
 * OpenLoo sync server.
 *
 * A deliberately small single-document store. There are no user accounts: the
 * whole point is "my dashboard, on all my devices", so the server holds exactly
 * one AppData document, guarded by one passcode. That keeps the attack surface
 * tiny — there is no registration, no per-user data, and no password database.
 *
 * Written against Node's standard library only (http, crypto, fs) so the image
 * is a plain `node:alpine` with nothing to `npm install` and nothing to audit.
 *
 * Concurrency model: a single process, so a promise-chain mutex serialises
 * writes, and an atomic temp-file rename makes each write all-or-nothing.
 * Cross-device edits are reconciled with an integer revision — a stale write is
 * rejected with 409 rather than silently clobbering a newer one.
 */
import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PORT = Number(process.env.PORT ?? 3000)
const DATA_DIR = process.env.DATA_DIR ?? '/data'

// A passcode can come from two places. The env var wins when set (ops override,
// and how existing deployments work). Otherwise the passcode is one the user
// creates through the first-run screen, stored hashed on the volume. When
// neither exists the server is in "setup" mode and refuses data access until a
// passcode is created.
const ENV_PASSCODE = process.env.OPENLOO_PASSCODE ?? ''
const HAS_ENV_PASSCODE = ENV_PASSCODE.length > 0
const MIN_PASSCODE_LENGTH = 6

const DATA_FILE = join(DATA_DIR, 'data.json')
const TOKENS_FILE = join(DATA_DIR, 'tokens.json')
const PASSCODE_FILE = join(DATA_DIR, 'passcode.json')

const MAX_BODY_BYTES = 5 * 1024 * 1024 // generous for a board with uploaded icons
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const TOKEN_BYTES = 32

// --- persistence -----------------------------------------------------------

/** Serialises all mutations; each enqueued job runs after the previous settles. */
let writeChain = Promise.resolve()
function withWriteLock(job) {
  const run = writeChain.then(job, job)
  // Swallow errors on the chain itself so one failure does not wedge the queue.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function atomicWriteJson(file, value) {
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`
  await writeFile(tmp, JSON.stringify(value), 'utf8')
  await rename(tmp, file) // atomic on the same filesystem
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    // A corrupt file should not take the server down; log and fall back.
    console.error(`[openloo] could not read ${file}:`, error.message)
    return fallback
  }
}

/** The stored document: { revision, data, updatedAt }. */
async function loadDocument() {
  return readJson(DATA_FILE, { revision: 0, data: null, updatedAt: 0 })
}

// --- tokens ----------------------------------------------------------------

/** token -> expiry (ms). Persisted so a restart does not log every device out. */
let tokens = new Map()

async function loadTokens() {
  const raw = await readJson(TOKENS_FILE, {})
  const now = Date.now()
  tokens = new Map(Object.entries(raw).filter(([, expiry]) => expiry > now))
}

async function persistTokens() {
  await atomicWriteJson(TOKENS_FILE, Object.fromEntries(tokens))
}

async function issueToken() {
  const token = randomBytes(TOKEN_BYTES).toString('hex')
  tokens.set(token, Date.now() + TOKEN_TTL_MS)
  await withWriteLock(persistTokens)
  return token
}

async function revokeToken(token) {
  if (tokens.delete(token)) await withWriteLock(persistTokens)
}

function tokenIsValid(token) {
  const expiry = tokens.get(token)
  if (!expiry) return false
  if (expiry <= Date.now()) {
    tokens.delete(token)
    return false
  }
  return true
}

// --- passcode --------------------------------------------------------------

const envHash = HAS_ENV_PASSCODE
  ? createHash('sha256').update(ENV_PASSCODE).digest()
  : null

/** A passcode created through the setup screen: { salt, hash } as hex. */
let storedPasscode = null

async function loadStoredPasscode() {
  storedPasscode = await readJson(PASSCODE_FILE, null)
}

/** No passcode configured anywhere yet — the server needs first-run setup. */
function needsSetup() {
  return !HAS_ENV_PASSCODE && storedPasscode === null
}

/** Whether clients must authenticate. True unless we are awaiting setup. */
function authRequired() {
  return !needsSetup()
}

/**
 * Persist a user-created passcode, salted and hashed. Rejects when a passcode
 * already exists (setup is one-time) or the passcode is too short.
 */
async function createPasscode(candidate) {
  if (!needsSetup()) throw Object.assign(new Error('Passcode already set.'), { statusCode: 409 })
  const passcode = String(candidate ?? '')
  if (passcode.length < MIN_PASSCODE_LENGTH) {
    throw Object.assign(
      new Error(`Passcode must be at least ${MIN_PASSCODE_LENGTH} characters.`),
      { statusCode: 400 },
    )
  }
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(salt + passcode).digest('hex')
  storedPasscode = { salt, hash }
  await withWriteLock(() => atomicWriteJson(PASSCODE_FILE, storedPasscode))
}

/** Constant-time passcode check against the env or stored credential. */
function passcodeMatches(candidate) {
  if (needsSetup()) return false
  const value = String(candidate ?? '')

  if (HAS_ENV_PASSCODE) {
    const candidateHash = createHash('sha256').update(value).digest()
    return timingSafeEqual(candidateHash, envHash)
  }

  const candidateHash = createHash('sha256').update(storedPasscode.salt + value).digest()
  const expected = Buffer.from(storedPasscode.hash, 'hex')
  return candidateHash.length === expected.length && timingSafeEqual(candidateHash, expected)
}

// Crude but effective brute-force brake: a short lockout after repeated misses,
// keyed by client address. Not a substitute for a strong passcode.
const failures = new Map()
const MAX_FAILURES = 8
const FAILURE_WINDOW_MS = 5 * 60 * 1000

function tooManyFailures(key) {
  const entry = failures.get(key)
  if (!entry) return false
  if (Date.now() - entry.first > FAILURE_WINDOW_MS) {
    failures.delete(key)
    return false
  }
  return entry.count >= MAX_FAILURES
}

function recordFailure(key) {
  const entry = failures.get(key)
  if (!entry || Date.now() - entry.first > FAILURE_WINDOW_MS) {
    failures.set(key, { count: 1, first: Date.now() })
  } else {
    entry.count += 1
  }
}

// --- http helpers ----------------------------------------------------------

function send(res, status, body, extraHeaders) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { statusCode: 400 }))
      }
    })
    req.on('error', reject)
  })
}

function bearerToken(req) {
  const header = req.headers['authorization'] ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1] : null
}

function clientKey(req) {
  // Behind the nginx proxy the socket address is the proxy; prefer the
  // forwarded address so the lockout tracks real clients.
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function authorized(req) {
  // Before a passcode exists, data is off-limits: the only allowed action is
  // creating the passcode (/api/setup, handled before this gate). This means a
  // fresh instance is never briefly readable while it waits to be set up.
  if (needsSetup()) return false
  const token = bearerToken(req)
  return token !== null && tokenIsValid(token)
}

// --- routes ----------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (path === '/api/health') {
    return send(res, 200, {
      ok: true,
      sync: true,
      authRequired: authRequired(),
      needsSetup: needsSetup(),
    })
  }

  // First-run: create the instance passcode. Only works before one exists.
  if (path === '/api/setup' && method === 'POST') {
    if (!needsSetup()) {
      return send(res, 409, { error: 'A passcode has already been set.' })
    }
    const body = await readBody(req).catch(() => undefined)
    await createPasscode(body?.passcode)
    // Log the creator straight in so they are not bounced to the login screen.
    const token = await issueToken()
    return send(res, 200, { token })
  }

  if (path === '/api/session' && method === 'POST') {
    if (needsSetup()) {
      return send(res, 409, { error: 'No passcode set yet. Create one first.' })
    }
    const key = clientKey(req)
    if (tooManyFailures(key)) {
      return send(res, 429, { error: 'Too many attempts. Wait a few minutes.' })
    }
    const body = await readBody(req).catch(() => undefined)
    if (passcodeMatches(body?.passcode)) {
      failures.delete(key)
      const token = await issueToken()
      return send(res, 200, { token })
    }
    recordFailure(key)
    return send(res, 401, { error: 'Wrong passcode.' })
  }

  if (path === '/api/session' && method === 'DELETE') {
    const token = bearerToken(req)
    if (token) await revokeToken(token)
    return send(res, 204)
  }

  // Everything past here needs a valid session (when a passcode is configured).
  if (!authorized(req)) {
    return send(res, 401, { error: 'Not authenticated.' })
  }

  if (path === '/api/revision' && method === 'GET') {
    const doc = await loadDocument()
    return send(res, 200, { revision: doc.revision })
  }

  if (path === '/api/data' && method === 'GET') {
    const doc = await loadDocument()
    return send(res, 200, { revision: doc.revision, data: doc.data })
  }

  if (path === '/api/data' && method === 'PUT') {
    const body = await readBody(req).catch((error) => {
      throw error
    })
    if (!body || typeof body !== 'object' || typeof body.revision !== 'number') {
      return send(res, 400, { error: 'Expected { revision, data }.' })
    }
    return withWriteLock(async () => {
      const current = await loadDocument()
      // Optimistic concurrency: reject a write built on a stale revision so a
      // second device cannot silently overwrite the first's newer changes.
      if (body.revision !== current.revision) {
        return send(res, 409, { revision: current.revision, data: current.data })
      }
      const next = {
        revision: current.revision + 1,
        data: body.data ?? null,
        updatedAt: Date.now(),
      }
      await atomicWriteJson(DATA_FILE, next)
      return send(res, 200, { revision: next.revision })
    })
  }

  return send(res, 404, { error: 'Not found.' })
}

// --- bootstrap -------------------------------------------------------------

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  await loadTokens()
  await loadStoredPasscode()

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      const status = error?.statusCode ?? 500
      if (status === 500) console.error('[openloo] request failed:', error)
      if (!res.headersSent) send(res, status, { error: error?.message ?? 'Server error.' })
    })
  })

  server.listen(PORT, () => {
    const mode = needsSetup()
      ? 'SETUP (waiting for a passcode to be created)'
      : HAS_ENV_PASSCODE
        ? 'ON (env passcode)'
        : 'ON (created passcode)'
    console.log(`[openloo] sync server on :${PORT} — auth ${mode}, data in ${DATA_DIR}`)
  })

  // Graceful shutdown so a redeploy does not drop in-flight writes.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)))
  }
}

main().catch((error) => {
  console.error('[openloo] failed to start:', error)
  process.exit(1)
})
