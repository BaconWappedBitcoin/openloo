import type { AppData } from '../types'

/**
 * The only way the app talks to persistence.
 *
 * OpenLoo ships with a browser-local adapter and no server. Keeping every read
 * and write behind this interface means adding a real backend later is a new
 * file here plus a config switch — not a rewrite of the UI. Implementations
 * are async even when the local one resolves immediately, so a networked
 * adapter is a drop-in.
 */
export interface StorageAdapter {
  /** Human-readable name, shown in settings. */
  readonly name: string
  /** Returns `null` when nothing has been stored yet. */
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
  /**
   * Notify when another context (another tab, or a future server push)
   * changes the data. Returns an unsubscribe function.
   */
  subscribe?(onExternalChange: (data: AppData) => void): () => void
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageError'
  }
}
