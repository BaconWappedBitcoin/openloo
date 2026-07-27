import { useState, type FormEvent } from 'react'
import { useStore } from '../store/useStore'
import { Button, inputClass } from './Modal'

/**
 * The passcode screen shown when a sync backend requires sign-in.
 *
 * This is not an account login — there is one shared passcode for the whole
 * instance, matching the single-document model. It exists so that "reachable on
 * my network" does not mean "editable by anyone on my network".
 */
export function LoginGate() {
  const login = useStore((state) => state.login)
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (passcode.trim() === '' || busy) return
    setBusy(true)
    setError(null)
    const ok = await login(passcode)
    setBusy(false)
    if (!ok) {
      setError('That passcode was not accepted.')
      setPasscode('')
    }
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
          <h1 className="text-lg font-semibold">OpenLoo</h1>
        </div>
        <p className="mb-5 text-sm text-[var(--color-ink-muted)]">
          This dashboard is synced. Enter the passcode to unlock it on this device.
        </p>

        <label className="mb-2 block text-sm font-medium" htmlFor="openloo-passcode">
          Passcode
        </label>
        <input
          id="openloo-passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => {
            setPasscode(event.target.value)
            setError(null)
          }}
          className={inputClass}
          aria-invalid={error !== null}
          aria-describedby={error ? 'openloo-passcode-error' : undefined}
        />
        {error ? (
          <p id="openloo-passcode-error" className="mt-2 text-xs text-red-500">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          className="mt-5 w-full"
          disabled={busy || passcode.trim() === ''}
        >
          {busy ? 'Checking…' : 'Unlock'}
        </Button>

        <p className="mt-4 text-xs text-[var(--color-ink-muted)]">
          Your boards live on this OpenLoo server and sync across every device you unlock.
        </p>
      </form>
    </div>
  )
}
