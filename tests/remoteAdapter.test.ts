import { afterEach, describe, expect, it, vi } from 'vitest'
import { RemoteStorageAdapter } from '../src/storage/remoteAdapter'
import type { AppData } from '../src/types'

function makeAppData(tag: string): AppData {
  return {
    version: 1,
    profiles: [
      {
        id: 'p1',
        name: 'P',
        activeWebmixId: 'w1',
        webmixes: [
          { id: 'w1', name: tag, cols: 9, rows: 6, createdAt: 0, updatedAt: 0, tiles: [] },
        ],
      },
    ],
    activeProfileId: 'p1',
    settings: {
      theme: 'auto',
      searchEngineId: 'duckduckgo',
      customSearchUrl: '',
      iconProvider: 'none',
      showSearch: true,
      tileRadius: 14,
      gap: 8,
    },
  }
}

/**
 * A fake sync server enforcing the same revision-based optimistic concurrency as
 * the real one, with an artificial delay on writes so that overlapping saves can
 * be provoked deterministically — the exact condition that produced spurious
 * "changed on another device" 409s when the client did not serialise its saves.
 */
function fakeServer(delayMs: number) {
  const state = { revision: 0, data: null as unknown }
  let conflicts = 0
  const respond = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const path = String(url).replace(/^.*\/api/, '')
    if (path === '/health') return respond(200, { ok: true, sync: true, authRequired: false })
    if (path === '/revision' && method === 'GET') return respond(200, { revision: state.revision })
    if (path === '/data' && method === 'GET') {
      return respond(200, { revision: state.revision, data: state.data })
    }
    if (path === '/data' && method === 'PUT') {
      const body = JSON.parse(String(init?.body)) as { revision: number; data: unknown }
      await new Promise((r) => setTimeout(r, delayMs))
      if (body.revision !== state.revision) {
        conflicts += 1
        return respond(409, { revision: state.revision, data: state.data })
      }
      state.revision += 1
      state.data = body.data
      return respond(200, { revision: state.revision })
    }
    return respond(404, {})
  })
  return { state, fetchImpl, conflicts: () => conflicts }
}

describe('RemoteStorageAdapter save serialization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('does not conflict with its own overlapping saves', async () => {
    const server = fakeServer(25)
    vi.stubGlobal('fetch', server.fetchImpl)

    const adapter = new RemoteStorageAdapter(false)
    await adapter.load() // establishes revision 0

    // Fire a second save before the first resolves — the overlap that used to
    // send a stale revision and get a spurious 409.
    const first = adapter.save(makeAppData('A'))
    const second = adapter.save(makeAppData('B'))
    await expect(Promise.all([first, second])).resolves.toBeDefined()

    // Both writes landed, in order, with no conflict surfaced.
    expect(server.state.revision).toBe(2)
    expect((server.state.data as AppData).profiles[0].webmixes[0].name).toBe('B')
  })

  it('survives a burst of rapid saves without a conflict error', async () => {
    const server = fakeServer(15)
    vi.stubGlobal('fetch', server.fetchImpl)

    const adapter = new RemoteStorageAdapter(false)
    await adapter.load()

    // Ten saves fired back-to-back, like a flurry of drag-and-drops.
    const saves = Array.from({ length: 10 }, (_, i) => adapter.save(makeAppData(`v${i}`)))
    await expect(Promise.all(saves)).resolves.toBeDefined()

    expect(server.state.revision).toBe(10)
    expect((server.state.data as AppData).profiles[0].webmixes[0].name).toBe('v9')
  })
})
