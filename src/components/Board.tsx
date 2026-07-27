import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Settings, Tile, Webmix } from '../types'
import { useStore } from '../store/useStore'
import type { BoardMetrics } from '../hooks/useBoardMetrics'
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

  const emptyCells = useMemo(() => (editMode ? findEmptyCells(webmix) : []), [editMode, webmix])

  return (
    // `overflow-auto` matters on small screens: once a cell would fall below the
    // legible minimum the board stops shrinking and scrolls instead.
    <div
      ref={containerRef}
      className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
    >
      <div
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
            className="absolute flex items-center justify-center border-2 border-dashed border-[var(--color-line)] text-xl text-[var(--color-ink-muted)] opacity-60 transition hover:border-blue-400 hover:text-blue-500 hover:opacity-100"
            style={{
              left: x * step,
              top: y * step,
              width: cell,
              height: cell,
              borderRadius: settings.tileRadius,
            }}
          >
            +
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
          />
        ))}
      </div>
    </div>
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
}

function BoardTile({ tile, settings, cell, step, editMode, dimmed, onEdit }: BoardTileProps) {
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
