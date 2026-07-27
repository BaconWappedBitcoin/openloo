import { LocalStorageAdapter } from './localAdapter'
import type { StorageAdapter } from './adapter'

export { StorageError } from './adapter'
export type { StorageAdapter } from './adapter'
export { LocalStorageAdapter, STORAGE_KEY } from './localAdapter'

/**
 * The adapter the app runs against.
 *
 * When a server-backed build lands, this is the single place that chooses
 * between implementations (on a build flag or a runtime probe).
 */
export function createStorageAdapter(): StorageAdapter {
  return new LocalStorageAdapter()
}
