import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { Profile, Settings, Tile, Webmix } from '../types'
import { useStore } from '../store/useStore'
import { useBoardMetrics } from '../hooks/useBoardMetrics'
import { Board } from './Board'
import { SearchBar } from './SearchBar'
import { TileFace } from './TileView'
import { WebmixTabs } from './WebmixTabs'

interface WorkspaceProps {
  profile: Profile
  webmix: Webmix
  settings: Settings
  editMode: boolean
  onEditTile(tile: Tile): void
  onAddTileAt(position: { x: number; y: number }): void
}

/**
 * Owns the drag context that spans the webmix tabs and the board, so a tile can
 * be dragged either to a new spot on the grid or onto another webmix's tab.
 * A single DndContext is required because a draggable and its drop targets must
 * share one context.
 */
export function Workspace({
  profile,
  webmix,
  settings,
  editMode,
  onEditTile,
  onAddTileAt,
}: WorkspaceProps) {
  const gap = settings.gap
  const [containerRef, metrics] = useBoardMetrics(webmix.cols, webmix.rows, gap)
  const { cell } = metrics
  const step = cell + gap

  const moveTile = useStore((state) => state.moveTile)
  const moveTileToWebmix = useStore((state) => state.moveTileToWebmix)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // A short threshold so a plain click still opens the link rather than reading
  // as a zero-distance drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const draggingTile = webmix.tiles.find((tile) => tile.id === draggingId) ?? null

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const id = String(event.active.id)
    const tile = webmix.tiles.find((candidate) => candidate.id === id)
    if (!tile) return

    // Dropped on a webmix tab → move the tile to that webmix.
    const overId = event.over ? String(event.over.id) : null
    if (overId && overId.startsWith('webmix:')) {
      moveTileToWebmix(id, overId.slice('webmix:'.length))
      return
    }

    // Otherwise translate the pixel drag into whole cells moved on the grid.
    if (step === 0) return
    const dx = Math.round(event.delta.x / step)
    const dy = Math.round(event.delta.y / step)
    if (dx === 0 && dy === 0) return
    moveTile(id, tile.x + dx, tile.y + dy)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <WebmixTabs profile={profile} activeWebmixId={webmix.id} draggingTile={draggingTile} />

      {settings.showSearch ? (
        <div className="px-4 pt-4">
          <SearchBar />
        </div>
      ) : null}

      <Board
        webmix={webmix}
        settings={settings}
        editMode={editMode}
        metrics={metrics}
        containerRef={containerRef}
        draggingId={draggingId}
        onEditTile={onEditTile}
        onAddTileAt={onAddTileAt}
      />

      <DragOverlay dropAnimation={null}>
        {draggingTile ? (
          <div
            style={{
              width: draggingTile.w * cell + (draggingTile.w - 1) * gap,
              height: draggingTile.h * cell + (draggingTile.h - 1) * gap,
            }}
          >
            <TileFace
              tile={draggingTile}
              settings={settings}
              cell={cell}
              radius={settings.tileRadius}
              lifted
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
