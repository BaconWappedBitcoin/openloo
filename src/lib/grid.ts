import type { Tile, Webmix } from '../types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function rectOf(tile: Tile): Rect {
  return { x: tile.x, y: tile.y, w: tile.w, h: tile.h }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function withinBounds(rect: Rect, cols: number, rows: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= cols && rect.y + rect.h <= rows
}

/** Tiles that would collide with `rect`, ignoring the tile being moved. */
export function collidingTiles(tiles: Tile[], rect: Rect, ignoreId?: string): Tile[] {
  return tiles.filter((tile) => tile.id !== ignoreId && overlaps(rectOf(tile), rect))
}

export function canPlace(
  tiles: Tile[],
  rect: Rect,
  cols: number,
  rows: number,
  ignoreId?: string,
): boolean {
  return withinBounds(rect, cols, rows) && collidingTiles(tiles, rect, ignoreId).length === 0
}

/**
 * First free position for a `w`×`h` tile, scanning row by row.
 * Returns `null` when the board is full.
 */
export function findFreeSpot(
  tiles: Tile[],
  cols: number,
  rows: number,
  w = 1,
  h = 1,
): { x: number; y: number } | null {
  for (let y = 0; y + h <= rows; y++) {
    for (let x = 0; x + w <= cols; x++) {
      if (canPlace(tiles, { x, y, w, h }, cols, rows)) return { x, y }
    }
  }
  return null
}

export type MoveResult =
  | { kind: 'move'; tiles: Tile[] }
  | { kind: 'swap'; tiles: Tile[] }
  | { kind: 'blocked' }

/**
 * Move `tileId` so its top-left cell lands on (`x`, `y`).
 *
 * Three outcomes, in order of preference:
 *  - the target area is free → move it there;
 *  - it is occupied by exactly one tile of identical size → swap the two;
 *  - anything else (partial overlap, mismatched sizes) → blocked, no change.
 *
 * Refusing the ambiguous cases keeps the board predictable: a drag either does
 * the obvious thing or visibly does nothing.
 */
export function moveTile(webmix: Webmix, tileId: string, x: number, y: number): MoveResult {
  const moving = webmix.tiles.find((tile) => tile.id === tileId)
  if (!moving) return { kind: 'blocked' }
  if (moving.x === x && moving.y === y) return { kind: 'blocked' }

  const target: Rect = { x, y, w: moving.w, h: moving.h }
  if (!withinBounds(target, webmix.cols, webmix.rows)) return { kind: 'blocked' }

  const blockers = collidingTiles(webmix.tiles, target, tileId)

  if (blockers.length === 0) {
    return {
      kind: 'move',
      tiles: webmix.tiles.map((tile) => (tile.id === tileId ? { ...tile, x, y } : tile)),
    }
  }

  if (blockers.length === 1) {
    const other = blockers[0]
    const sameSize = other.w === moving.w && other.h === moving.h
    if (sameSize) {
      return {
        kind: 'swap',
        tiles: webmix.tiles.map((tile) => {
          if (tile.id === tileId) return { ...tile, x, y }
          if (tile.id === other.id) return { ...tile, x: moving.x, y: moving.y }
          return tile
        }),
      }
    }
  }

  return { kind: 'blocked' }
}

/**
 * Resize a tile in place, refusing sizes that would overflow the board or
 * overlap a neighbour.
 */
export function resizeTile(webmix: Webmix, tileId: string, w: number, h: number): Tile[] | null {
  const tile = webmix.tiles.find((candidate) => candidate.id === tileId)
  if (!tile) return null
  const rect: Rect = { x: tile.x, y: tile.y, w, h }
  if (!canPlace(webmix.tiles, rect, webmix.cols, webmix.rows, tileId)) return null
  return webmix.tiles.map((candidate) =>
    candidate.id === tileId ? { ...candidate, w, h } : candidate,
  )
}

/**
 * Drop tiles that no longer fit after the grid is shrunk, relocating them when
 * there is still room. Returns the surviving tiles plus what was removed, so
 * the UI can tell the user rather than silently losing bookmarks.
 */
export function reflowToGrid(
  tiles: Tile[],
  cols: number,
  rows: number,
): { tiles: Tile[]; removed: Tile[] } {
  const kept: Tile[] = []
  const removed: Tile[] = []

  for (const tile of tiles) {
    const clampedW = Math.min(tile.w, cols)
    const clampedH = Math.min(tile.h, rows)
    const candidate = { ...tile, w: clampedW, h: clampedH }

    if (canPlace(kept, rectOf(candidate), cols, rows)) {
      kept.push(candidate)
      continue
    }
    const spot = findFreeSpot(kept, cols, rows, clampedW, clampedH)
    if (spot) {
      kept.push({ ...candidate, x: spot.x, y: spot.y })
    } else {
      removed.push(tile)
    }
  }

  return { tiles: kept, removed }
}
