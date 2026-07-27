import { useState } from 'react'
import type { Profile } from '../types'
import { useStore } from '../store/useStore'

interface WebmixTabsProps {
  profile: Profile
  activeWebmixId: string
}

export function WebmixTabs({ profile, activeWebmixId }: WebmixTabsProps) {
  const setActiveWebmix = useStore((state) => state.setActiveWebmix)
  const addWebmix = useStore((state) => state.addWebmix)
  const renameWebmix = useStore((state) => state.renameWebmix)
  const removeWebmix = useStore((state) => state.removeWebmix)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  return (
    <div
      className="flex items-center gap-1 overflow-x-auto border-t border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2"
      role="tablist"
      aria-label="Webmixes"
    >
      {profile.webmixes.map((webmix) => {
        const active = webmix.id === activeWebmixId

        if (renamingId === webmix.id) {
          return (
            <input
              key={webmix.id}
              autoFocus
              defaultValue={webmix.name}
              maxLength={60}
              onBlur={(event) => {
                renameWebmix(webmix.id, event.target.value)
                setRenamingId(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') setRenamingId(null)
              }}
              className="w-32 rounded-lg border border-blue-500 bg-[var(--color-surface)] px-2.5 py-1.5 text-sm outline-none"
              aria-label={`Rename ${webmix.name}`}
            />
          )
        }

        return (
          <div key={webmix.id} className="group relative shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveWebmix(webmix.id)}
              onDoubleClick={() => setRenamingId(webmix.id)}
              title={`${webmix.name} (double-click to rename)`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)]'
              }`}
            >
              {webmix.name}
            </button>

            {profile.webmixes.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete the webmix "${webmix.name}"? You can undo this.`)) {
                    removeWebmix(webmix.id)
                  }
                }}
                aria-label={`Delete webmix ${webmix.name}`}
                className="absolute -top-1 -right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] leading-none text-white group-hover:flex focus-visible:flex"
              >
                &times;
              </button>
            ) : null}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => addWebmix('New webmix')}
        className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)]"
        aria-label="Add a webmix"
      >
        + Webmix
      </button>
    </div>
  )
}
