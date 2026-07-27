import type { IconProvider } from '../types'
import { hostOf } from './url'

/**
 * Favicon lookup is opt-in and off by default.
 *
 * Both providers are third parties: asking them for an icon tells them which
 * domains you have bookmarked. A self-hosted dashboard that silently leaked
 * that would defeat the point, so `none` is the default and the settings
 * dialog states the trade-off plainly.
 */
export function faviconUrl(url: string, provider: IconProvider): string | null {
  if (provider === 'none') return null
  const host = hostOf(url)
  if (!host) return null
  if (provider === 'duckduckgo') return `https://icons.duckduckgo.com/ip3/${host}.ico`
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
}

/** Up to two initials from a title, for the default letter icon. */
export function initialsOf(title: string): string {
  const words = title.trim().split(/[\s\-_/]+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    return [...words[0]].slice(0, 2).join('').toUpperCase()
  }
  return (firstGlyph(words[0]) + firstGlyph(words[1])).toUpperCase()
}

function firstGlyph(word: string): string {
  return [...word][0] ?? ''
}
