import { useMemo, useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { IconSpec, Settings, Tile, Webmix } from '../types'
import { useStore } from '../store/useStore'
import { safeLinkUrl, suggestTitle } from '../lib/url'
import type { BoardMetrics } from '../hooks/useBoardMetrics'
import { TileContextMenu, type TileMenuState } from './TileContextMenu'
import { TileFace, tileLabel } from './TileView'

interface BoardProps {
  webmix: Webmix
  settings: Settings
  editMode: boolean
  /** Measured cell/board size, owned by the surrounding Workspace. */
  metrics: BoardMetrics
  /** Attached to the scrollable board container so Workspace can measure it. */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Id of the tile currently being dragged, so it can be shown dimmed. */
  draggingId: string | null
  onEditTile(tile: Tile): void
  onAddTileAt(position: { x: number; y: number }): void
}

/**
 * The grid of tiles. Drag orchestration (the DndContext, sensors, overlay) lives
 * in Workspace so that a tile can be dragged from here onto a webmix tab; this
 * component only renders the grid and its draggable/clickable tiles.
 */
export function Board({
  webmix,
  settings,
  editMode,
  metrics,
  containerRef,
  draggingId,
  onEditTile,
  onAddTileAt,
}: BoardProps) {
  const gap = settings.gap
  const { cell, boardWidth, boardHeight, ready } = metrics
  const step = cell + gap

  // Empty cells are shown in both modes now: faint blanks that reveal an "add"
  // affordance on hover, so a tile can be added anywhere without entering edit
  // mode. (`editMode` still governs the drag/delete controls on real tiles.)
  const emptyCells = useMemo(() => findEmptyCells(webmix), [webmix])

  const addTile = useStore((state) => state.addTile)
  const notify = useStore((state) => state.notify)
  const gridRef = useRef<HTMLDivElement>(null)
  const [urlDropActive, setUrlDropActive] = useState(false)
  const [menu, setMenu] = useState<TileMenuState | null>(null)

  function openMenu(tile: Tile, event: React.MouseEvent) {
    event.preventDefault()
    setMenu({ tile, x: event.clientX, y: event.clientY })
  }

  // Drop a link (from the address bar, another tab, a bookmark, or selected
  // text) anywhere on the board to make a tile — no edit mode needed. This is
  // native HTML5 drag-and-drop, separate from the pointer-based tile dragging.
  const hasUrlPayload = (dt: DataTransfer) =>
    dt.types.includes('text/uri-list') || dt.types.includes('text/plain')

  function onUrlDragOver(event: React.DragEvent) {
    if (!hasUrlPayload(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!urlDropActive) setUrlDropActive(true)
  }

  function onUrlDragLeave(event: React.DragEvent) {
    // Ignore leave events fired when moving between the container's children.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setUrlDropActive(false)
  }

  function onUrlDrop(event: React.DragEvent) {
    if (!hasUrlPayload(event.dataTransfer)) return
    event.preventDefault()
    setUrlDropActive(false)

    const raw =
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
    // A uri-list may carry comment lines beginning with '#'; take the first URL.
    const candidate =
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('#')) ?? ''
    const url = safeLinkUrl(candidate)
    if (!url) {
      notify('Drop a web link (http or https) to add a tile.', 'error')
      return
    }

    // Place it on the cell it was dropped over, when that lands inside the grid.
    let position: { x: number; y: number } | undefined
    const rect = gridRef.current?.getBoundingClientRect()
    if (rect && step > 0) {
      const x = Math.floor((event.clientX - rect.left) / step)
      const y = Math.floor((event.clientY - rect.top) / step)
      if (x >= 0 && x < webmix.cols && y >= 0 && y < webmix.rows) position = { x, y }
    }

    const icon: IconSpec =
      settings.iconProvider !== 'none' ? { kind: 'favicon' } : { kind: 'letter' }
    addTile({ url, title: suggestTitle(url) || 'Untitled', icon, ...position })
  }

  return (
    <>
    {/* `overflow-auto` matters on small screens: once a cell would fall below the
        legible minimum the board stops shrinking and scrolls instead. */}
    <div
      ref={containerRef}
      onDragOver={onUrlDragOver}
      onDragLeave={onUrlDragLeave}
      onDrop={onUrlDrop}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
    >
      {urlDropActive ? (
        <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-500/10 text-sm font-medium text-blue-500">
          Drop to add a tile
        </div>
      ) : null}

      <div
        ref={gridRef}
        className="relative shrink-0"
        style={{ width: boardWidth, height: boardHeight, visibility: ready ? undefined : 'hidden' }}
        role="grid"
        aria-label={`${webmix.name} — ${webmix.cols} by ${webmix.rows} grid`}
      >
        {emptyCells.map(({ x, y }) => (
          <button
            key={`${x}:${y}`}
            type="button"
            onClick={() => onAddTileAt({ x, y })}
            aria-label={`Add a tile at column ${x + 1}, row ${y + 1}`}
            title="Add a tile"
            className="group/add absolute flex items-center justify-center text-[var(--color-ink-muted)] shadow-sm transition hover:text-blue-500"
            style={{
              left: x * step,
              top: y * step,
              width: cell,
              height: cell,
              borderRadius: settings.tileRadius,
              // A filled blank "slot" with the same shadow as a real tile, so
              // empty cells read as placeholders rather than gaps.
              backgroundColor: 'color-mix(in srgb, var(--color-ink) 8%, transparent)',
            }}
          >
            <span className="text-2xl opacity-0 transition group-hover/add:opacity-100">+</span>
          </button>
        ))}

        {webmix.tiles.map((tile) => (
          <BoardTile
            key={tile.id}
            tile={tile}
            settings={settings}
            cell={cell}
            step={step}
            editMode={editMode}
            dimmed={draggingId === tile.id}
            onEdit={() => onEditTile(tile)}
            onContext={(event) => openMenu(tile, event)}
          />
        ))}
      </div>
    </div>

    {menu ? (
      <TileContextMenu
        menu={menu}
        settings={settings}
        onEdit={onEditTile}
        onClose={() => setMenu(null)}
      />
    ) : null}
    </>
  )
}

interface BoardTileProps {
  tile: Tile
  settings: Settings
  cell: number
  step: number
  editMode: boolean
  dimmed: boolean
  onEdit(): void
  onContext(event: React.MouseEvent): void
}

function BoardTile({ tile, settings, cell, step, editMode, dimmed, onEdit, onContext }: BoardTileProps) {
  const moveTile = useStore((state) => state.moveTile)
  const removeTile = useStore((state) => state.removeTile)
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: tile.id,
    disabled: !editMode,
  })

  const gap = settings.gap
  const style: React.CSSProperties = {
    left: tile.x * step,
    top: tile.y * step,
    width: tile.w * cell + (tile.w - 1) * gap,
    height: tile.h * cell + (tile.h - 1) * gap,
  }

  const face = (
    <TileFace tile={tile} settings={settings} cell={cell} radius={settings.tileRadius} dimmed={dimmed} />
  )

  if (editMode) {
    // Arrow keys nudge the focused tile, which is the keyboard equivalent of
    // dragging and avoids relying on a pointer.
    const onKeyDown = (event: React.KeyboardEvent) => {
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }
      const delta = deltas[event.key]
      if (!delta) return
      event.preventDefault()
      moveTile(tile.id, tile.x + delta[0], tile.y + delta[1])
    }

    return (
      <div className="absolute" style={style}>
        <button
          ref={setNodeRef}
          type="button"
          {...listeners}
          {...attributes}
          onClick={onEdit}
          onKeyDown={onKeyDown}
          onContextMenu={onContext}
          aria-label={`Edit ${tile.title}. Arrow keys to move, or drag onto an Openmix tab.`}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        >
          {face}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            removeTile(tile.id)
          }}
          aria-label={`Delete ${tile.title}`}
          title="Delete tile (undo with Ctrl+Z)"
          className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs leading-none text-white shadow hover:bg-red-700"
        >
          &times;
        </button>
      </div>
    )
  }

  return (
    <a
      href={tile.url}
      // A dashboard is a home base, so bookmarks open in a new tab by default
      // (tile.openInNewTab defaults true). A tile can opt into same-tab.
      target={tile.openInNewTab ? '_blank' : undefined}
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      // Links are natively draggable; disable it so dragging a tile does not
      // start a URL drag that the board's own drop handler would turn into a
      // duplicate tile. Moving tiles is an edit-mode action (pointer-based).
      draggable={false}
      onContextMenu={onContext}
      title={tileLabel(tile)}
      className="absolute transition-transform hover:scale-[1.04]"
      style={style}
    >
      {face}
    </a>
  )
}

/** Cells not covered by any tile, used to render the add-a-tile placeholders. */
function findEmptyCells(webmix: Webmix): { x: number; y: number }[] {
  const occupied = new Set<string>()
  for (const tile of webmix.tiles) {
    for (let dy = 0; dy < tile.h; dy++) {
      for (let dx = 0; dx < tile.w; dx++) {
        occupied.add(`${tile.x + dx}:${tile.y + dy}`)
      }
    }
  }

  const cells: { x: number; y: number }[] = []
  for (let y = 0; y < webmix.rows; y++) {
    for (let x = 0; x < webmix.cols; x++) {
      if (!occupied.has(`${x}:${y}`)) cells.push({ x, y })
    }
  }
  return cells
}
