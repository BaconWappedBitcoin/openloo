import { describe, expect, it } from 'vitest'
import { decodeWebmix, encodeWebmix } from '../src/lib/share'
import type { Webmix } from '../src/types'

const sample: Webmix = {
  id: 'w1',
  name: 'Reading',
  cols: 4,
  rows: 3,
  createdAt: 1,
  updatedAt: 2,
  tiles: [
    {
      id: 't1',
      title: 'Wikipedia',
      url: 'https://www.wikipedia.org/',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      color: '#0091ff',
      icon: { kind: 'letter' },
      openInNewTab: false,
    },
    {
      id: 't2',
      title: 'Archive',
      url: 'https://archive.org/',
      x: 2,
      y: 1,
      w: 2,
      h: 1,
      color: '#46a758',
      icon: { kind: 'emoji', char: '📚' },
      openInNewTab: true,
    },
  ],
}

describe('share round-trip', () => {
  it('preserves the board through encode and decode', async () => {
    const decoded = await decodeWebmix(await encodeWebmix(sample))

    expect(decoded).not.toBeNull()
    expect(decoded!.name).toBe('Reading')
    expect(decoded!.cols).toBe(4)
    expect(decoded!.tiles).toHaveLength(2)
    expect(decoded!.tiles[1]).toMatchObject({
      title: 'Archive',
      url: 'https://archive.org/',
      x: 2,
      y: 1,
      w: 2,
      icon: { kind: 'emoji', char: '📚' },
      openInNewTab: true,
    })
  })

  it('assigns a fresh id so an import cannot overwrite the original', async () => {
    const decoded = await decodeWebmix(await encodeWebmix(sample))
    expect(decoded!.id).not.toBe(sample.id)
  })

  it('produces a payload that is URL-safe', async () => {
    const payload = await encodeWebmix(sample)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('sanitizes a hostile payload rather than trusting it', async () => {
    const hostile = {
      name: 'Trap',
      cols: 3,
      rows: 3,
      tiles: [
        { title: 'Bank', url: 'javascript:steal()', x: 0, y: 0, w: 1, h: 1 },
        { title: 'Real', url: 'https://example.com', x: 1, y: 0, w: 1, h: 1 },
      ],
    }
    const payload = await encodeWebmix(hostile as unknown as Webmix)
    const decoded = await decodeWebmix(payload)

    expect(decoded!.tiles).toHaveLength(1)
    expect(decoded!.tiles[0].title).toBe('Real')
  })

  it('returns null for malformed input instead of throwing', async () => {
    expect(await decodeWebmix('')).toBeNull()
    expect(await decodeWebmix('xnot-a-real-payload')).toBeNull()
    expect(await decodeWebmix('r!!!!')).toBeNull()
  })
})
