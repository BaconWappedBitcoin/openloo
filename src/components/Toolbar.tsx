import type { Profile } from '../types'
import { useStore } from '../store/useStore'

interface ToolbarProps {
  profiles: Profile[]
  activeProfileId: string
  onOpenSettings(): void
  onOpenShare(): void
  onAddTile(): void
}

export function Toolbar({
  profiles,
  activeProfileId,
  onOpenSettings,
  onOpenShare,
  onAddTile,
}: ToolbarProps) {
  const editMode = useStore((state) => state.editMode)
  const setEditMode = useStore((state) => state.setEditMode)
  const setActiveProfile = useStore((state) => state.setActiveProfile)
  const undo = useStore((state) => state.undo)
  const hasHistory = useStore((state) => state.history.length > 0)

  return (
    <header className="flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 py-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-base font-bold tracking-tight" aria-hidden>
          ◲
        </span>
        <span className="hidden text-sm font-semibold sm:inline">OpenLoo</span>
      </div>

      <label className="sr-only" htmlFor="openloo-profile">
        Profile
      </label>
      <select
        id="openloo-profile"
        value={activeProfileId}
        onChange={(event) => setActiveProfile(event.target.value)}
        className="max-w-[10rem] shrink-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        <ToolbarButton onClick={undo} disabled={!hasHistory} label="Undo (Ctrl+Z)">
          Undo
        </ToolbarButton>

        <ToolbarButton onClick={onAddTile} label="Add a tile">
          + Tile
        </ToolbarButton>

        <ToolbarButton onClick={onOpenShare} label="Import, export, share or migrate">
          Import/Export
        </ToolbarButton>

        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          aria-pressed={editMode}
          title="Toggle edit mode (E)"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            editMode
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)]'
          }`}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>

        <ToolbarButton onClick={onOpenSettings} label="Settings">
          ⚙
        </ToolbarButton>
      </div>
    </header>
  )
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick(): void
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
