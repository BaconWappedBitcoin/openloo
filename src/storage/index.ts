import { LocalStorageAdapter } from './localAdapter'
import { probeBackend, RemoteStorageAdapter } from './remoteAdapter'
import type { StorageAdapter } from './adapter'

export { AuthRequiredError, StorageError } from './adapter'
export type { AuthController, StorageAdapter } from './adapter'
export { LocalStorageAdapter, STORAGE_KEY } from './localAdapter'
export { RemoteStorageAdapter } from './remoteAdapter'

/**
 * Choose the storage backend at runtime.
 *
 * The same build runs two ways. Where a sync server answers `/api/health`
 * (a self-hosted install), reads and writes go to it and the dashboard follows
 * the user across devices. Where nothing answers — the GitHub Pages demo, or
 * any plain static host — it falls back to browser-local storage. Probing at
 * runtime rather than baking the choice in means one artifact serves both.
 */
export async function resolveStorageAdapter(): Promise<StorageAdapter> {
  const health = await probeBackend()
  if (health) return new RemoteStorageAdapter(health.authRequired)
  return new LocalStorageAdapter()
}
