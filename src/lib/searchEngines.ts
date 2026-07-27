export interface SearchEngine {
  id: string
  name: string
  /** Template with `%s` where the encoded query goes. */
  template: string
}

export const SEARCH_ENGINES: SearchEngine[] = [
  { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q=%s' },
  { id: 'startpage', name: 'Startpage', template: 'https://www.startpage.com/sp/search?query=%s' },
  { id: 'brave', name: 'Brave', template: 'https://search.brave.com/search?q=%s' },
  { id: 'google', name: 'Google', template: 'https://www.google.com/search?q=%s' },
  { id: 'bing', name: 'Bing', template: 'https://www.bing.com/search?q=%s' },
  { id: 'ecosia', name: 'Ecosia', template: 'https://www.ecosia.org/search?q=%s' },
  { id: 'wikipedia', name: 'Wikipedia', template: 'https://en.wikipedia.org/w/index.php?search=%s' },
  { id: 'youtube', name: 'YouTube', template: 'https://www.youtube.com/results?search_query=%s' },
  { id: 'custom', name: 'Custom…', template: '' },
]

export function engineById(id: string): SearchEngine {
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[0]
}

/**
 * Build a search URL. Returns `null` when the template is unusable, so the
 * caller can surface a settings error instead of navigating somewhere odd.
 */
export function buildSearchUrl(
  query: string,
  engineId: string,
  customTemplate: string,
): string | null {
  const engine = engineById(engineId)
  const template = engine.id === 'custom' ? customTemplate : engine.template
  if (!template.includes('%s')) return null
  const url = template.replace('%s', encodeURIComponent(query))
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
