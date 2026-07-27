import { describe, expect, it } from 'vitest'
import { sanitizeAppData, sanitizeWebmix } from '../src/lib/sanitize'
import { safeImageUrl, safeLinkUrl } from '../src/lib/url'

/**
 * These cover the trust boundary: anything reaching `sanitize` may have come
 * from a shared link or an imported file written by someone else.
 */

describe('safeLinkUrl', () => {
  it('accepts http and https', () => {
    expect(safeLinkUrl('https://example.com')).toBe('https://example.com/')
    expect(safeLinkUrl('example.com')).toBe('https://example.com/')
  })

  it('rejects script-bearing schemes', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull()
    expect(safeLinkUrl('  javascript:alert(1)')).toBeNull()
    expect(safeLinkUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeLinkUrl('file:///etc/passwd')).toBeNull()
    expect(safeLinkUrl('vbscript:msgbox(1)')).toBeNull()
  })
})

describe('safeImageUrl', () => {
  it('accepts remote images and base64 raster data URIs', () => {
    expect(safeImageUrl('https://example.com/i.png')).toBe('https://example.com/i.png')
    expect(safeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toContain('data:image/png')
  })

  it('rejects SVG data URIs, which can carry script', () => {
    expect(safeImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeNull()
  })

  it('rejects non-image data URIs', () => {
    expect(safeImageUrl('data:text/html;base64,PGgxPmhpPC9oMT4=')).toBeNull()
  })
})

describe('sanitizeWebmix', () => {
  it('drops tiles with unsafe URLs but keeps the rest', () => {
    const result = sanitizeWebmix({
      name: 'Mixed',
      cols: 4,
      rows: 3,
      tiles: [
        { title: 'Good', url: 'https://example.com', x: 0, y: 0, w: 1, h: 1 },
        { title: 'Bad', url: 'javascript:alert(1)', x: 1, y: 0, w: 1, h: 1 },
      ],
    })
    expect(result?.tiles).toHaveLength(1)
    expect(result?.tiles[0].title).toBe('Good')
  })

  it('strips control and bidi-override characters from titles', () => {
    // U+202E (right-to-left override) can make a stored title render as
    // something completely different, so it must not survive sanitising.
    const RLO = String.fromCodePoint(0x202e)
    const NUL = String.fromCodePoint(0x00)

    const result = sanitizeWebmix({
      name: 'T',
      cols: 2,
      rows: 2,
      tiles: [
        {
          title: `evil${NUL}${RLO}title`,
          url: 'https://example.com',
          x: 0,
          y: 0,
          w: 1,
          h: 1,
        },
      ],
    })

    expect(result?.tiles[0].title).toBe('eviltitle')
  })

  it('resolves overlapping positions instead of stacking tiles', () => {
    const result = sanitizeWebmix({
      name: 'Overlap',
      cols: 3,
      rows: 3,
      tiles: [
        { title: 'A', url: 'https://a.example', x: 0, y: 0, w: 1, h: 1 },
        { title: 'B', url: 'https://b.example', x: 0, y: 0, w: 1, h: 1 },
      ],
    })
    const [a, b] = result!.tiles
    expect(`${a.x}:${a.y}`).not.toBe(`${b.x}:${b.y}`)
  })

  it('clamps out-of-range geometry', () => {
    const result = sanitizeWebmix({
      name: 'Huge',
      cols: 9999,
      rows: -5,
      tiles: [{ title: 'A', url: 'https://a.example', x: 500, y: 500, w: 99, h: 99 }],
    })
    expect(result!.cols).toBeLessThanOrEqual(16)
    expect(result!.rows).toBeGreaterThanOrEqual(2)
    const tile = result!.tiles[0]
    expect(tile.x + tile.w).toBeLessThanOrEqual(result!.cols)
    expect(tile.y + tile.h).toBeLessThanOrEqual(result!.rows)
  })

  it('ignores unknown fields rather than passing them through', () => {
    const result = sanitizeWebmix({
      name: 'X',
      cols: 2,
      rows: 2,
      evil: 'payload',
      tiles: [
        { title: 'A', url: 'https://a.example', x: 0, y: 0, w: 1, h: 1, onclick: 'alert(1)' },
      ],
    })
    expect(result).not.toHaveProperty('evil')
    expect(result!.tiles[0]).not.toHaveProperty('onclick')
  })

  it('rejects values that are not objects', () => {
    expect(sanitizeWebmix(null)).toBeNull()
    expect(sanitizeWebmix('nope')).toBeNull()
    expect(sanitizeWebmix(42)).toBeNull()
  })

  it('imports a Symbaloo-exported webmix intact (url icons, hex colours, 12-wide grid)', () => {
    // The shape the Symbaloo export snippet produces.
    const converted = {
      name: 'US Homepage',
      cols: 12,
      rows: 6,
      tiles: [
        {
          title: 'MathNook',
          url: 'https://www.mathnook.com/',
          x: 1,
          y: 1,
          w: 1,
          h: 1,
          color: '#f17a21',
          icon: { kind: 'url', src: 'https://img02.symbaloo.com/abc.png' },
          openInNewTab: true,
        },
        {
          title: 'Canva for Education',
          url: 'https://www.canva.com/education/',
          x: 0,
          y: 1,
          w: 1,
          h: 1,
          icon: { kind: 'url', src: 'https://cdn01.symbaloo.com/def.png' },
          openInNewTab: true,
        },
      ],
    }

    const result = sanitizeWebmix(converted)
    expect(result?.name).toBe('US Homepage')
    expect(result?.cols).toBe(12)
    expect(result?.tiles).toHaveLength(2)
    const math = result!.tiles.find((t) => t.title === 'MathNook')!
    expect(math.url).toBe('https://www.mathnook.com/')
    expect(math.color).toBe('#f17a21')
    // The Symbaloo tile image survives as a url icon.
    expect(math.icon).toMatchObject({ kind: 'url', src: 'https://img02.symbaloo.com/abc.png' })
  })
})

describe('sanitizeAppData', () => {
  it('rejects a document with no usable profiles', () => {
    expect(sanitizeAppData({ profiles: [] })).toBeNull()
    expect(sanitizeAppData({ profiles: [{ webmixes: [] }] })).toBeNull()
  })

  it('repairs a dangling active-profile pointer', () => {
    const result = sanitizeAppData({
      profiles: [
        {
          id: 'p1',
          name: 'One',
          activeWebmixId: 'missing',
          webmixes: [{ id: 'w1', name: 'W', cols: 3, rows: 3, tiles: [] }],
        },
      ],
      activeProfileId: 'does-not-exist',
    })
    expect(result!.activeProfileId).toBe('p1')
    expect(result!.profiles[0].activeWebmixId).toBe('w1')
  })

  it('falls back to default settings when they are malformed', () => {
    const result = sanitizeAppData({
      profiles: [
        {
          id: 'p1',
          name: 'One',
          activeWebmixId: 'w1',
          webmixes: [{ id: 'w1', name: 'W', cols: 3, rows: 3, tiles: [] }],
        },
      ],
      activeProfileId: 'p1',
      settings: { theme: 'neon', iconProvider: 'evil-corp', gap: 9999 },
    })
    expect(result!.settings.theme).toBe('auto')
    expect(result!.settings.iconProvider).toBe('none')
    expect(result!.settings.gap).toBeLessThanOrEqual(32)
  })
})
