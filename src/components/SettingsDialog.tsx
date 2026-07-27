import { useState } from 'react'
import { GRID_LIMITS, type IconProvider, type Profile, type ThemeMode, type Webmix } from '../types'
import { SEARCH_ENGINES } from '../lib/searchEngines'
import { useStore } from '../store/useStore'
import { Button, Field, inputClass, Modal } from './Modal'

interface SettingsDialogProps {
  webmix: Webmix
  profiles: Profile[]
  activeProfileId: string
  onClose(): void
}

export function SettingsDialog({
  webmix,
  profiles,
  activeProfileId,
  onClose,
}: SettingsDialogProps) {
  const settings = useStore((state) => state.data.settings)
  const updateSettings = useStore((state) => state.updateSettings)
  const setGridSize = useStore((state) => state.setGridSize)
  const addProfile = useStore((state) => state.addProfile)
  const renameProfile = useStore((state) => state.renameProfile)
  const removeProfile = useStore((state) => state.removeProfile)
  const resetEverything = useStore((state) => state.resetEverything)
  const syncMode = useStore((state) => state.syncMode)
  const storageName = useStore((state) => state.storageName)
  const logout = useStore((state) => state.logout)
  const [newProfileName, setNewProfileName] = useState('')

  return (
    <Modal title="Settings" onClose={onClose} wide footer={<Button onClick={onClose}>Done</Button>}>
      <section className="mb-7">
        <SectionTitle>Storage</SectionTitle>
        {syncMode === 'server' ? (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-sm">
            <p className="mb-1 font-medium text-green-600 dark:text-green-400">
              ● Synced across your devices
            </p>
            <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
              Boards are saved on this OpenLoo server and stay in sync everywhere you sign in.
            </p>
            <Button
              onClick={() => {
                if (confirm('Sign out on this device? Your boards stay safe on the server.')) {
                  void logout()
                  onClose()
                }
              }}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Saved in this browser only ({storageName}). Boards do not sync to other devices —
            use Share → Export for a backup, or self-host with sync enabled.
          </p>
        )}
      </section>

      <section className="mb-7">
        <SectionTitle>Appearance</SectionTitle>

        <Field label="Theme">
          <div className="flex gap-2">
            {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
              <Choice
                key={mode}
                active={settings.theme === mode}
                onClick={() => updateSettings({ theme: mode })}
              >
                {mode === 'auto' ? 'Match system' : mode[0].toUpperCase() + mode.slice(1)}
              </Choice>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Corner radius — ${settings.tileRadius}px`}>
            <input
              type="range"
              min={0}
              max={40}
              value={settings.tileRadius}
              onChange={(event) => updateSettings({ tileRadius: Number(event.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label={`Gap — ${settings.gap}px`}>
            <input
              type="range"
              min={0}
              max={32}
              value={settings.gap}
              onChange={(event) => updateSettings({ gap: Number(event.target.value) })}
              className="w-full"
            />
          </Field>
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle>Grid — “{webmix.name}”</SectionTitle>
        <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
          Applies to the current webmix. Shrinking the grid can displace tiles; anything that
          cannot be rehomed is removed and reported, and undo restores it.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Columns">
            <input
              type="number"
              className={inputClass}
              min={GRID_LIMITS.minCols}
              max={GRID_LIMITS.maxCols}
              value={webmix.cols}
              onChange={(event) => setGridSize(Number(event.target.value), webmix.rows)}
            />
          </Field>
          <Field label="Rows">
            <input
              type="number"
              className={inputClass}
              min={GRID_LIMITS.minRows}
              max={GRID_LIMITS.maxRows}
              value={webmix.rows}
              onChange={(event) => setGridSize(webmix.cols, Number(event.target.value))}
            />
          </Field>
        </div>
      </section>

      <section className="mb-7">
        <SectionTitle>Search</SectionTitle>

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showSearch}
            onChange={(event) => updateSettings({ showSearch: event.target.checked })}
          />
          Show the search bar
        </label>

        <Field label="Engine">
          <select
            className={inputClass}
            value={settings.searchEngineId}
            onChange={(event) => updateSettings({ searchEngineId: event.target.value })}
          >
            {SEARCH_ENGINES.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.name}
              </option>
            ))}
          </select>
        </Field>

        {settings.searchEngineId === 'custom' ? (
          <Field
            label="Custom search URL"
            hint="Use %s where the query goes, e.g. https://example.com/search?q=%s"
          >
            <input
              className={inputClass}
              value={settings.customSearchUrl}
              onChange={(event) => updateSettings({ customSearchUrl: event.target.value })}
              placeholder="https://example.com/search?q=%s"
            />
          </Field>
        ) : null}
      </section>

      <section className="mb-7">
        <SectionTitle>Privacy</SectionTitle>
        <Field
          label="Favicon provider"
          hint="Fetching favicons tells the chosen provider which sites you have bookmarked. With “None”, OpenLoo makes no third-party requests at all — tiles fall back to initials, an emoji, or an image you upload."
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['none', 'None (no requests)'],
                ['duckduckgo', 'DuckDuckGo'],
                ['google', 'Google'],
              ] as [IconProvider, string][]
            ).map(([value, label]) => (
              <Choice
                key={value}
                active={settings.iconProvider === value}
                onClick={() => updateSettings({ iconProvider: value })}
              >
                {label}
              </Choice>
            ))}
          </div>
        </Field>
      </section>

      <section className="mb-7">
        <SectionTitle>Profiles</SectionTitle>
        <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
          Profiles are separate sets of webmixes stored in this browser. They are a convenience,
          not a security boundary — anyone using this browser can switch between them.
        </p>

        <ul className="mb-3 flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center gap-2">
              <input
                className={inputClass}
                defaultValue={profile.name}
                maxLength={60}
                onBlur={(event) => renameProfile(profile.id, event.target.value)}
                aria-label={`Name of profile ${profile.name}`}
              />
              <Button
                variant="danger"
                disabled={profiles.length <= 1}
                onClick={() => {
                  const count = profile.webmixes.length
                  if (
                    confirm(
                      `Delete profile “${profile.name}” and its ${count} webmix${
                        count === 1 ? '' : 'es'
                      }? You can undo this.`,
                    )
                  ) {
                    removeProfile(profile.id)
                  }
                }}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <input
            className={inputClass}
            value={newProfileName}
            placeholder="New profile name"
            maxLength={60}
            onChange={(event) => setNewProfileName(event.target.value)}
          />
          <Button
            onClick={() => {
              addProfile(newProfileName)
              setNewProfileName('')
            }}
            disabled={newProfileName.trim() === ''}
          >
            Add
          </Button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          Active profile: {profiles.find((p) => p.id === activeProfileId)?.name}
        </p>
      </section>

      <section>
        <SectionTitle>Danger zone</SectionTitle>
        <Button
          variant="danger"
          onClick={() => {
            if (
              confirm(
                'Delete all profiles, webmixes and tiles on this device and start over? Export a backup first if you want to keep anything.',
              )
            ) {
              resetEverything()
              onClose()
            }
          }}
        >
          Reset everything
        </Button>
      </section>
    </Modal>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold">{children}</h3>
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300'
          : 'border-[var(--color-line)] hover:bg-[var(--color-surface)]'
      }`}
    >
      {children}
    </button>
  )
}
