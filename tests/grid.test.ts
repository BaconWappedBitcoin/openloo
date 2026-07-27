import { describe, expect, it } from 'vitest'
import { canPlace, findFreeSpot, moveTile, reflowToGrid, resizeTile } from '../src/lib/grid'
import type { Tile, Webmix } from '../src/types'

function tile(id: string, x: number, y: number, w = 1, h = 1): Tile {
  return {
    id,
    title: id,
    url: `https://example.com/${id}`,
    x,
    y,
    w,
    h,
    color: '#0091ff',
    icon: { kind: 'letter' },
    openInNewTab: false,
  }
}

function webmix(tiles: Tile[], cols = 4, rows = 3): Webmix {
  return { id: 'w', name: 'Test', cols, rows, tiles, createdAt: 0, updatedAt: 0 }
}

describe('canPlace', () => {
  it('rejects positions outside the grid', () => {
    expect(canPlace([], { x: 3, y: 0, w: 2, h: 1 }, 4, 3)).toBe(false)
    expect(canPlace([], { x: -1, y: 0, w: 1, h: 1 }, 4, 3)).toBe(false)
    expect(canPlace([], { x: 0, y: 2, w: 1, h: 2 }, 4, 3)).toBe(false)
  })

  it('rejects overlaps but ignores the tile being moved', () => {
    const tiles = [tile('a', 1, 1)]
    expect(canPlace(tiles, { x: 1, y: 1, w: 1, h: 1 }, 4, 3)).toBe(false)
    expect(canPlace(tiles, { x: 1, y: 1, w: 1, h: 1 }, 4, 3, 'a')).toBe(true)
  })

  it('detects partial overlap of a large tile', () => {
    const tiles = [tile('big', 0, 0, 2, 2)]
    expect(canPlace(tiles, { x: 1, y: 1, w: 1, h: 1 }, 4, 3)).toBe(false)
    expect(canPlace(tiles, { x: 2, y: 0, w: 1, h: 1 }, 4, 3)).toBe(true)
  })
})

describe('findFreeSpot', () => {
  it('scans row by row', () => {
    expect(findFreeSpot([tile('a', 0, 0)], 4, 3)).toEqual({ x: 1, y: 0 })
  })

  it('accounts for the requested size', () => {
    const tiles = [tile('a', 0, 0), tile('b', 2, 0)]
    // A 2-wide tile cannot fit at x=1 (b is at x=2), so it lands on row 1.
    expect(findFreeSpot(tiles, 4, 3, 2, 1)).toEqual({ x: 0, y: 1 })
  })

  it('returns null when the board is full', () => {
    const full = Array.from({ length: 4 }, (_, x) => tile(`t${x}`, x, 0))
    expect(findFreeSpot(full, 4, 1)).toBeNull()
  })
})

describe('moveTile', () => {
  it('moves into free space', () => {
    const result = moveTile(webmix([tile('a', 0, 0)]), 'a', 2, 1)
    expect(result.kind).toBe('move')
    if (result.kind !== 'blocked') {
      expect(result.tiles[0]).toMatchObject({ x: 2, y: 1 })
    }
  })

  it('swaps with a same-sized neighbour', () => {
    const result = moveTile(webmix([tile('a', 0, 0), tile('b', 1, 0)]), 'a', 1, 0)
    expect(result.kind).toBe('swap')
    if (result.kind !== 'blocked') {
      expect(result.tiles.find((t) => t.id === 'a')).toMatchObject({ x: 1, y: 0 })
      expect(result.tiles.find((t) => t.id === 'b')).toMatchObject({ x: 0, y: 0 })
    }
  })

  it('refuses to swap tiles of different sizes', () => {
    const board = webmix([tile('a', 0, 0), tile('big', 1, 0, 2, 2)])
    expect(moveTile(board, 'a', 1, 0).kind).toBe('blocked')
  })

  it('refuses a move that would leave the grid', () => {
    expect(moveTile(webmix([tile('a', 0, 0)]), 'a', 4, 0).kind).toBe('blocked')
    expect(moveTile(webmix([tile('a', 0, 0)]), 'a', -1, 0).kind).toBe('blocked')
  })

  it('refuses a move that overlaps two tiles at once', () => {
    const board = webmix([tile('wide', 0, 0, 2, 1), tile('b', 2, 0), tile('c', 3, 0)])
    expect(moveTile(board, 'wide', 2, 0).kind).toBe('blocked')
  })
})

describe('resizeTile', () => {
  it('grows into free space', () => {
    const tiles = resizeTile(webmix([tile('a', 0, 0)]), 'a', 2, 2)
    expect(tiles?.[0]).toMatchObject({ w: 2, h: 2 })
  })

  it('refuses to grow over a neighbour', () => {
    expect(resizeTile(webmix([tile('a', 0, 0), tile('b', 1, 0)]), 'a', 2, 1)).toBeNull()
  })

  it('refuses to grow past the edge', () => {
    expect(resizeTile(webmix([tile('a', 3, 0)]), 'a', 2, 1)).toBeNull()
  })
})

describe('reflowToGrid', () => {
  it('keeps tiles that still fit', () => {
    const { tiles, removed } = reflowToGrid([tile('a', 0, 0), tile('b', 1, 1)], 4, 3)
    expect(removed).toHaveLength(0)
    expect(tiles).toHaveLength(2)
  })

  it('relocates tiles pushed outside a shrunken grid', () => {
    const { tiles, removed } = reflowToGrid([tile('a', 3, 2)], 2, 2)
    expect(removed).toHaveLength(0)
    expect(tiles[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('reports tiles it could not rehome instead of dropping them silently', () => {
    const many = Array.from({ length: 5 }, (_, i) => tile(`t${i}`, i, 0))
    const { tiles, removed } = reflowToGrid(many, 2, 2)
    expect(tiles).toHaveLength(4)
    expect(removed).toHaveLength(1)
  })
})
