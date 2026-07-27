import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Profile, Tile } from '../types'
import { useStore } from '../store/useStore'

interface WebmixTabsProps {
  profile: Profile
  activeWebmixId: string
  /** The tile currently being dragged, if any — turns tabs into drop targets. */
  draggingTile?: Tile | null
}

/**
 * The row of webmix "pages" across the top. Prominent on purpose: this is the
 * primary way to move between boards. While a tile is being dragged, each tab
 * becomes a drop target so a tile can be flung onto another page.
 */
export function WebmixTabs({ profile, activeWebmixId, draggingTile }: WebmixTabsProps) {
  const setActiveWebmix = useStore((state) => state.setActiveWebmix)
  const addWebmix = useStore((state) => state.addWebmix)
  const renameWebmix = useStore((state) => state.renameWebmix)
  const removeWebmix = useStore((state) => state.removeWebmix)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const dragging = draggingTile ?? null

  return (
    <div
      className="flex items-stretch gap-1.5 overflow-x-auto border-b border-[var(--color-line)] bg-[var(--color-surface-raised)] px-3 pt-2"
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
              className="mb-2 w-36 self-center rounded-lg border border-blue-500 bg-[var(--color-surface)] px-3 py-2 text-sm outline-none"
              aria-label={`Rename ${webmix.name}`}
            />
          )
        }

        return (
          <WebmixTab
            key={webmix.id}
            webmix={webmix}
            active={active}
            canDelete={profile.webmixes.length > 1}
            // A tile can only be dropped onto a webmix other than the one it is on.
            dropEnabled={dragging !== null && webmix.id !== activeWebmixId}
            onSelect={() => setActiveWebmix(webmix.id)}
            onRename={() => setRenamingId(webmix.id)}
            onDelete={() => {
              if (confirm(`Delete the webmix "${webmix.name}"? You can undo this.`)) {
                removeWebmix(webmix.id)
              }
            }}
          />
        )
      })}

      <button
        type="button"
        onClick={() => addWebmix('New webmix')}
        className="mb-2 shrink-0 self-center rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-ink-muted)] transition hover:bg-[var(--color-surface)]"
        aria-label="Add a webmix"
      >
        + Webmix
      </button>
    </div>
  )
}

interface WebmixTabProps {
  webmix: Profile['webmixes'][number]
  active: boolean
  canDelete: boolean
  dropEnabled: boolean
  onSelect(): void
  onRename(): void
  onDelete(): void
}

function WebmixTab({
  webmix,
  active,
  canDelete,
  dropEnabled,
  onSelect,
  onRename,
  onDelete,
}: WebmixTabProps) {
  // Always a droppable: dnd-kit only measures drop targets that exist at drag
  // start, so toggling this on mid-drag would miss it. Dropping a tile on its
  // own current tab is a harmless no-op in the store. `dropEnabled` drives only
  // the visual affordance.
  const { setNodeRef, isOver } = useDroppable({ id: `webmix:${webmix.id}` })

  return (
    <div ref={setNodeRef} className="group relative shrink-0">
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
        onDoubleClick={onRename}
        title={`${webmix.name} (double-click to rename)`}
        className={`mb-[-1px] rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
          active
            ? 'border-blue-500 bg-[var(--color-surface)] text-[var(--color-ink)]'
            : 'border-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)]'
        } ${
          // Highlight as a drop target while a tile is being dragged over it.
          dropEnabled ? 'ring-1 ring-blue-400/40' : ''
        } ${isOver ? 'bg-blue-500/20 ring-2 ring-blue-500' : ''}`}
      >
        {webmix.name}
      </button>

      {canDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete webmix ${webmix.name}`}
          className="absolute top-0.5 right-0 hidden h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] leading-none text-white group-hover:flex focus-visible:flex"
        >
          &times;
        </button>
      ) : null}
    </div>
  )
}
