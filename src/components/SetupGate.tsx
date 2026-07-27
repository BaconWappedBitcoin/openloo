import { useState, type FormEvent } from 'react'
import { useStore } from '../store/useStore'
import { Button, inputClass } from './Modal'

const MIN_LENGTH = 6

/**
 * First-run screen for a synced instance that has no passcode yet.
 *
 * Shown instead of the login gate when the server reports `needsSetup`. Whoever
 * reaches a fresh instance first sets the passcode — so on a reachable network
 * you want to do this promptly. There is no username; this passcode is the
 * whole login, for every device.
 */
export function SetupGate() {
  const setupPasscode = useStore((state) => state.setupPasscode)
  const [passcode, setPasscode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tooShort = passcode.length > 0 && passcode.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && confirm !== passcode
  const canSubmit = passcode.length >= MIN_LENGTH && confirm === passcode && !busy

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const ok = await setupPasscode(passcode)
    setBusy(false)
    if (!ok) setError('Could not create the passcode. It may already be set — reload the page.')
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden className="text-lg">
            ◲
          </span>
          <h1 className="text-lg font-semibold">Welcome to OpenLoo</h1>
        </div>
        <p className="mb-5 text-sm text-[var(--color-ink-muted)]">
          Set a passcode to protect this synced dashboard. You will use it to unlock OpenLoo on
          each of your devices.
        </p>

        <label className="mb-2 block text-sm font-medium" htmlFor="openloo-new-passcode">
          New passcode
        </label>
        <input
          id="openloo-new-passcode"
          type="password"
          autoFocus
          autoComplete="new-password"
          value={passcode}
          onChange={(event) => {
            setPasscode(event.target.value)
            setError(null)
          }}
          className={inputClass}
          aria-invalid={tooShort}
        />
        {tooShort ? (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
            Use at least {MIN_LENGTH} characters — longer is better.
          </p>
        ) : null}

        <label className="mt-4 mb-2 block text-sm font-medium" htmlFor="openloo-confirm-passcode">
          Confirm passcode
        </label>
        <input
          id="openloo-confirm-passcode"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={inputClass}
          aria-invalid={mismatch}
        />
        {mismatch ? (
          <p className="mt-1.5 text-xs text-red-500">The two passcodes do not match.</p>
        ) : null}

        {error ? <p className="mt-3 text-xs text-red-500">{error}</p> : null}

        <Button type="submit" variant="primary" className="mt-5 w-full" disabled={!canSubmit}>
          {busy ? 'Creating…' : 'Create passcode & continue'}
        </Button>

        <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
          Keep it safe — there is no reset. It is stored only as a hash on your server.
        </p>
      </form>
    </div>
  )
}
