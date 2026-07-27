import { useRef, useState, type FormEvent } from 'react'
import { useStore } from '../store/useStore'
import { buildSearchUrl, engineById, SEARCH_ENGINES } from '../lib/searchEngines'
import { safeLinkUrl } from '../lib/url'

export function SearchBar() {
  const settings = useStore((state) => state.data.settings)
  const updateSettings = useStore((state) => state.updateSettings)
  const notify = useStore((state) => state.notify)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const engine = engineById(settings.searchEngineId)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return

    // Typing a bare domain should go there directly rather than search for it.
    if (looksLikeUrl(trimmed)) {
      const direct = safeLinkUrl(trimmed)
      if (direct) {
        window.location.href = direct
        return
      }
    }

    const url = buildSearchUrl(trimmed, settings.searchEngineId, settings.customSearchUrl)
    if (!url) {
      notify('That search engine is not configured correctly. Check Settings.', 'error')
      return
    }
    window.location.href = url
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-xl items-center gap-2">
      <div className="flex flex-1 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-2 py-1 shadow-sm focus-within:border-blue-500">
        <label className="sr-only" htmlFor="openloo-engine">
          Search engine
        </label>
        <select
          id="openloo-engine"
          value={settings.searchEngineId}
          onChange={(event) => updateSettings({ searchEngineId: event.target.value })}
          className="cursor-pointer rounded-full bg-transparent px-2 py-1.5 text-sm text-[var(--color-ink-muted)] outline-none"
        >
          {SEARCH_ENGINES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="openloo-search">
          Search the web
        </label>
        <input
          id="openloo-search"
          ref={inputRef}
          data-search-input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search with ${engine.name}, or type a URL`}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
        />

        <button
          type="submit"
          className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go
        </button>
      </div>
    </form>
  )
}

/** Heuristic: `example.com`, `example.com/x`, or anything with an explicit scheme. */
function looksLikeUrl(value: string): boolean {
  if (/\s/.test(value)) return false
  if (/^https?:\/\//i.test(value)) return true
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|:\d)/i.test(value)
}
