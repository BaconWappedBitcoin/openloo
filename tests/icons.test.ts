import { describe, expect, it } from 'vitest'
import { ALL_ICONS, ICON_SET } from '../src/lib/icons'
import { initialsOf } from '../src/lib/favicon'

describe('curated icon set', () => {
  it('has non-empty, labelled groups', () => {
    expect(ICON_SET.length).toBeGreaterThan(0)
    for (const group of ICON_SET) {
      expect(group.label).not.toBe('')
      expect(group.icons.length).toBeGreaterThan(0)
    }
  })

  it('contains no duplicate icons across groups', () => {
    expect(new Set(ALL_ICONS).size).toBe(ALL_ICONS.length)
  })

  it('contains only single glyphs, not text', () => {
    for (const icon of ALL_ICONS) {
      // Each entry should be a short emoji, not a word.
      expect(icon.length).toBeLessThanOrEqual(4)
      expect(/[a-z0-9]/i.test(icon)).toBe(false)
    }
  })
})

describe('initialsOf', () => {
  it('takes the first two words', () => {
    expect(initialsOf('Hacker News')).toBe('HN')
  })

  it('takes two letters from a single word', () => {
    expect(initialsOf('Wikipedia')).toBe('WI')
  })

  it('handles separators and empties', () => {
    expect(initialsOf('project-gutenberg')).toBe('PG')
    expect(initialsOf('')).toBe('?')
  })
})
