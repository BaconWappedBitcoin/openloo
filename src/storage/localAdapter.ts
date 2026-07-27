import type { AppData } from '../types'
import { sanitizeAppData } from '../lib/sanitize'
import { StorageError, type StorageAdapter } from './adapter'

export const STORAGE_KEY = 'openloo:v1'

/**
 * Persists to `localStorage`.
 *
 * Stored data is re-validated on read, not trusted: it may have been written
 * by an older build, hand-edited in devtools, or left behind by another app
 * on the same origin.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'This browser'

  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<AppData | null> {
    let raw: string | null
    try {
      raw = localStorage.getItem(this.key)
    } catch (cause) {
      // Private-mode Safari and hardened browser settings can throw on access.
      throw new StorageError('Local storage is not available in this browser.', cause)
    }
    if (!raw) return null
    try {
      return sanitizeAppData(JSON.parse(raw))
    } catch {
      // Corrupt JSON: treat as a fresh install rather than wedging the app.
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(data))
    } catch (cause) {
      const quotaExceeded =
        cause instanceof DOMException &&
        (cause.name === 'QuotaExceededError' || cause.code === 22)
      throw new StorageError(
        quotaExceeded
          ? 'Out of local storage space. Large uploaded icons are the usual cause — try removing some, or export a backup and trim old Openmixes.'
          : 'Could not save to local storage.',
        cause,
      )
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(this.key)
    } catch (cause) {
      throw new StorageError('Could not clear local storage.', cause)
    }
  }

  /** Keeps two open tabs of the dashboard in sync. */
  subscribe(onExternalChange: (data: AppData) => void): () => void {
    const handler = (event: StorageEvent) => {
      if (event.key !== this.key || event.newValue === null) return
      try {
        const data = sanitizeAppData(JSON.parse(event.newValue))
        if (data) onExternalChange(data)
      } catch {
        // Ignore unparseable writes from another tab.
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }
}
