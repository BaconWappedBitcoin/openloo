import { create } from 'zustand'
import type { AppData, Profile, Settings, Tile, Webmix } from '../types'
import { GRID_LIMITS } from '../types'
import { createInitialData, createProfile, createTile, createWebmix } from '../lib/defaults'
import {
  canPlace,
  findFreeSpot,
  moveTile as computeMove,
  reflowToGrid,
  resizeTile,
} from '../lib/grid'
import { newId } from '../lib/id'
import {
  AuthRequiredError,
  LocalStorageAdapter,
  resolveStorageAdapter,
  StorageError,
  type StorageAdapter,
} from '../storage'

// The active adapter, resolved during init(). Defaults to local so anything
// that reads it before init (it shouldn't) degrades gracefully rather than
// crashing. `let` because init() swaps in the real one once the backend probe
// completes; the persistence subscription below reads it lazily at save time.
let adapter: StorageAdapter = new LocalStorageAdapter()

/** How long to coalesce rapid edits before writing to storage. */
const SAVE_DEBOUNCE_MS = 250
const MAX_HISTORY = 40

export type Status = 'loading' | 'ready' | 'error'

/**
 * Authentication state, only meaningful when a sync backend is in use.
 *  - `none`: browser-local storage, no auth involved.
 *  - `setup`: a backend with no passcode yet — the user must create one.
 *  - `required`: a backend that needs a passcode, and we are not signed in.
 *  - `authed`: signed in (or a backend that needs no passcode).
 */
export type AuthState = 'none' | 'setup' | 'required' | 'authed'

/** Everything the tile editor can specify when creating a tile. */
export interface NewTileInput {
  url: string
  title: string
  x?: number
  y?: number
  w?: number
  h?: number
  color?: string
  icon?: Tile['icon']
  openInNewTab?: boolean
}

export interface Notice {
  id: string
  kind: 'info' | 'error'
  message: string
}

interface StoreState {
  data: AppData
  status: Status
  /** Snapshots for undo, newest last. */
  history: AppData[]
  editMode: boolean
  notices: Notice[]

  /** How persistence is happening: local browser storage, or a synced server. */
  syncMode: 'local' | 'server'
  /** Human label for the active adapter, shown in settings. */
  storageName: string
  authState: AuthState

  init(): Promise<void>
  login(passcode: string): Promise<boolean>
  setupPasscode(passcode: string): Promise<boolean>
  logout(): Promise<void>
  notify(message: string, kind?: Notice['kind']): void
  dismissNotice(id: string): void
  undo(): void
  canUndo(): boolean
  setEditMode(on: boolean): void

  // Tiles
  addTile(input: NewTileInput): void
  updateTile(id: string, patch: Partial<Omit<Tile, 'id'>>): void
  removeTile(id: string): void
  moveTile(id: string, x: number, y: number): void
  setTileSize(id: string, w: number, h: number): void
  /** Move a tile out of its current webmix into another one in the profile. */
  moveTileToWebmix(tileId: string, targetWebmixId: string): boolean

  // Webmixes
  addWebmix(name: string): void
  renameWebmix(id: string, name: string): void
  removeWebmix(id: string): void
  setActiveWebmix(id: string): void
  setGridSize(cols: number, rows: number): void
  importWebmix(webmix: Webmix): void

  // Profiles
  addProfile(name: string): void
  renameProfile(id: string, name: string): void
  removeProfile(id: string): void
  setActiveProfile(id: string): void

  updateSettings(patch: Partial<Settings>): void
  replaceAll(data: AppData): void
  resetEverything(): void
}

export const useStore = create<StoreState>()((set, get) => {
  /**
   * Apply a change to the document.
   *
   * `recordHistory` is opt-out because most edits should be undoable; the
   * exceptions are things the user cannot perceive as a change (switching
   * tabs, toggling a setting) where an undo step would just be noise.
   */
  function mutate(fn: (draft: AppData) => AppData, recordHistory = true): void {
    const { data, history } = get()
    const next = fn(data)
    if (next === data) return
    set({
      data: next,
      history: recordHistory ? [...history, data].slice(-MAX_HISTORY) : history,
    })
  }

  function mutateWebmix(fn: (webmix: Webmix) => Webmix | null, recordHistory = true): void {
    mutate((data) => {
      const profile = activeProfileOf(data)
      const webmix = activeWebmixOf(data)
      if (!profile || !webmix) return data
      const nextWebmix = fn(webmix)
      if (!nextWebmix) return data
      return replaceWebmix(data, profile.id, { ...nextWebmix, updatedAt: Date.now() })
    }, recordHistory)
  }

  /** Load the document and move to `ready`; used after init and after login. */
  async function loadData(): Promise<void> {
    try {
      const stored = await adapter.load()
      set({ data: stored ?? createInitialData(), status: 'ready', authState: 'authed' })
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        // The backend wants a passcode we do not have; show the gate.
        set({ authState: 'required', status: 'ready' })
        return
      }
      // Storage being unavailable is recoverable: run in memory and say so.
      set({ data: createInitialData(), status: 'ready' })
      get().notify(
        error instanceof StorageError
          ? `${error.message} Changes will be lost when you close this tab.`
          : 'Could not read saved data. Starting fresh.',
        'error',
      )
    }
  }

  function wireSubscription(): void {
    adapter.subscribe?.((incoming) => {
      // Another tab or device wrote; adopt its state rather than fight over it.
      set({ data: incoming })
    })
  }

  return {
    data: createInitialData(),
    status: 'loading',
    history: [],
    editMode: false,
    notices: [],
    syncMode: 'local',
    storageName: 'This browser',
    authState: 'none',

    async init() {
      // Pick local vs. synced storage by probing the backend, then load.
      adapter = await resolveStorageAdapter()
      const auth = adapter.auth
      set({ syncMode: auth ? 'server' : 'local', storageName: adapter.name })

      // First run on a synced instance with no passcode yet: show the setup
      // screen and go no further until one is created.
      if (auth?.needsSetup) {
        set({ authState: 'setup', status: 'ready' })
        return
      }

      // A passcode exists but we do not hold a session: show the sign-in gate.
      if (auth?.required && !auth.isAuthed()) {
        set({ authState: 'required', status: 'ready' })
        return
      }

      set({ authState: auth ? 'authed' : 'none' })
      await loadData()
      wireSubscription()
    },

    async login(passcode) {
      const auth = adapter.auth
      if (!auth) return false
      try {
        const ok = await auth.login(passcode)
        if (!ok) return false
        await loadData()
        wireSubscription()
        return true
      } catch (error) {
        get().notify(
          error instanceof StorageError ? error.message : 'Could not sign in.',
          'error',
        )
        return false
      }
    },

    async setupPasscode(passcode) {
      const auth = adapter.auth
      if (!auth) return false
      try {
        const ok = await auth.setup(passcode)
        if (!ok) return false
        await loadData()
        wireSubscription()
        return true
      } catch (error) {
        get().notify(
          error instanceof StorageError ? error.message : 'Could not create the passcode.',
          'error',
        )
        return false
      }
    },

    async logout() {
      await adapter.auth?.logout()
      // Drop back to the gate with a clean slate so the previous data is not
      // left on screen for the next person.
      set({ authState: 'required', data: createInitialData(), history: [] })
    },

    notify(message, kind = 'info') {
      const notice: Notice = { id: newId(), kind, message }
      set({ notices: [...get().notices, notice] })
      setTimeout(() => get().dismissNotice(notice.id), kind === 'error' ? 9000 : 4000)
    },

    dismissNotice(id) {
      set({ notices: get().notices.filter((notice) => notice.id !== id) })
    },

    undo() {
      const { history } = get()
      const previous = history[history.length - 1]
      if (!previous) return
      set({ data: previous, history: history.slice(0, -1) })
    },

    canUndo() {
      return get().history.length > 0
    },

    setEditMode(on) {
      set({ editMode: on })
    },

    addTile(input) {
      mutateWebmix((webmix) => {
        const w = input.w ?? 1
        const h = input.h ?? 1
        const { cols, rows, tiles } = webmix

        // Honour the requested cell when the tile actually fits there — a
        // multi-cell tile added from an empty cell near the edge may not — and
        // otherwise fall back to the first spot that can hold it.
        const requested =
          input.x !== undefined && input.y !== undefined ? { x: input.x, y: input.y } : null
        const position =
          requested && canPlace(tiles, { ...requested, w, h }, cols, rows)
            ? requested
            : findFreeSpot(tiles, cols, rows, w, h)

        if (!position) {
          get().notify(
            'No room for a tile that size — enlarge the grid or remove a tile.',
            'error',
          )
          return null
        }

        return {
          ...webmix,
          tiles: [...tiles, createTile({ ...input, x: position.x, y: position.y, w, h })],
        }
      })
    },

    updateTile(id, patch) {
      mutateWebmix((webmix) => ({
        ...webmix,
        tiles: webmix.tiles.map((tile) => (tile.id === id ? { ...tile, ...patch, id } : tile)),
      }))
    },

    removeTile(id) {
      mutateWebmix((webmix) => ({
        ...webmix,
        tiles: webmix.tiles.filter((tile) => tile.id !== id),
      }))
    },

    moveTile(id, x, y) {
      mutateWebmix((webmix) => {
        const result = computeMove(webmix, id, x, y)
        if (result.kind === 'blocked') return null
        return { ...webmix, tiles: result.tiles }
      })
    },

    setTileSize(id, w, h) {
      mutateWebmix((webmix) => {
        const tiles = resizeTile(webmix, id, w, h)
        if (!tiles) {
          get().notify('Not enough room for that size here.', 'error')
          return null
        }
        return { ...webmix, tiles }
      })
    },

    moveTileToWebmix(tileId, targetWebmixId) {
      const { data, history } = get()
      const profile = activeProfileOf(data)
      if (!profile) return false

      const source = profile.webmixes.find((mix) => mix.tiles.some((t) => t.id === tileId))
      const target = profile.webmixes.find((mix) => mix.id === targetWebmixId)
      if (!source || !target || source.id === target.id) return false

      const tile = source.tiles.find((t) => t.id === tileId)
      if (!tile) return false

      // The destination grid may be smaller, so clamp the tile and find a slot;
      // refuse (rather than overlap) when the target has no room.
      const w = Math.min(tile.w, target.cols)
      const h = Math.min(tile.h, target.rows)
      const spot = findFreeSpot(target.tiles, target.cols, target.rows, w, h)
      if (!spot) {
        get().notify(`"${target.name}" has no room for that tile.`, 'error')
        return false
      }

      const now = Date.now()
      const moved = { ...tile, x: spot.x, y: spot.y, w, h }
      const nextProfile = {
        ...profile,
        webmixes: profile.webmixes.map((mix) => {
          if (mix.id === source.id) {
            return { ...mix, tiles: mix.tiles.filter((t) => t.id !== tileId), updatedAt: now }
          }
          if (mix.id === target.id) {
            return { ...mix, tiles: [...mix.tiles, moved], updatedAt: now }
          }
          return mix
        }),
      }

      set({
        data: replaceProfile(data, nextProfile),
        history: [...history, data].slice(-MAX_HISTORY),
      })
      get().notify(`Moved "${tile.title}" to "${target.name}".`)
      return true
    },

    addWebmix(name) {
      mutate((data) => {
        const profile = activeProfileOf(data)
        if (!profile) return data
        const webmix = createWebmix(name.trim() || 'New webmix')
        const nextProfile: Profile = {
          ...profile,
          webmixes: [...profile.webmixes, webmix],
          activeWebmixId: webmix.id,
        }
        return replaceProfile(data, nextProfile)
      })
    },

    renameWebmix(id, name) {
      mutate((data) => {
        const profile = activeProfileOf(data)
        if (!profile) return data
        return replaceProfile(data, {
          ...profile,
          webmixes: profile.webmixes.map((webmix) =>
            webmix.id === id ? { ...webmix, name: name.trim() || webmix.name } : webmix,
          ),
        })
      })
    },

    removeWebmix(id) {
      mutate((data) => {
        const profile = activeProfileOf(data)
        if (!profile) return data
        // A profile with no webmixes has no coherent UI; keep the last one.
        if (profile.webmixes.length <= 1) {
          get().notify('A profile needs at least one Openmix.', 'error')
          return data
        }
        const webmixes = profile.webmixes.filter((webmix) => webmix.id !== id)
        return replaceProfile(data, {
          ...profile,
          webmixes,
          activeWebmixId:
            profile.activeWebmixId === id ? webmixes[0].id : profile.activeWebmixId,
        })
      })
    },

    setActiveWebmix(id) {
      mutate((data) => {
        const profile = activeProfileOf(data)
        if (!profile || !profile.webmixes.some((webmix) => webmix.id === id)) return data
        return replaceProfile(data, { ...profile, activeWebmixId: id })
      }, false)
    },

    setGridSize(cols, rows) {
      const clampedCols = clamp(cols, GRID_LIMITS.minCols, GRID_LIMITS.maxCols)
      const clampedRows = clamp(rows, GRID_LIMITS.minRows, GRID_LIMITS.maxRows)
      mutateWebmix((webmix) => {
        const { tiles, removed } = reflowToGrid(webmix.tiles, clampedCols, clampedRows)
        if (removed.length > 0) {
          get().notify(
            `${removed.length} tile${removed.length === 1 ? '' : 's'} did not fit and ${
              removed.length === 1 ? 'was' : 'were'
            } removed. Undo to restore.`,
            'error',
          )
        }
        return { ...webmix, cols: clampedCols, rows: clampedRows, tiles }
      })
    },

    importWebmix(webmix) {
      mutate((data) => {
        const profile = activeProfileOf(data)
        if (!profile) return data
        // Fresh id so importing twice does not collide with the original.
        const imported: Webmix = { ...webmix, id: newId() }
        return replaceProfile(data, {
          ...profile,
          webmixes: [...profile.webmixes, imported],
          activeWebmixId: imported.id,
        })
      })
    },

    addProfile(name) {
      mutate((data) => {
        const profile = createProfile(name.trim() || 'New profile')
        return { ...data, profiles: [...data.profiles, profile], activeProfileId: profile.id }
      })
    },

    renameProfile(id, name) {
      mutate((data) => ({
        ...data,
        profiles: data.profiles.map((profile) =>
          profile.id === id ? { ...profile, name: name.trim() || profile.name } : profile,
        ),
      }))
    },

    removeProfile(id) {
      mutate((data) => {
        if (data.profiles.length <= 1) {
          get().notify('You need at least one profile.', 'error')
          return data
        }
        const profiles = data.profiles.filter((profile) => profile.id !== id)
        return {
          ...data,
          profiles,
          activeProfileId: data.activeProfileId === id ? profiles[0].id : data.activeProfileId,
        }
      })
    },

    setActiveProfile(id) {
      mutate(
        (data) =>
          data.profiles.some((profile) => profile.id === id)
            ? { ...data, activeProfileId: id }
            : data,
        false,
      )
    },

    updateSettings(patch) {
      mutate((data) => ({ ...data, settings: { ...data.settings, ...patch } }), false)
    },

    replaceAll(data) {
      mutate(() => data)
    },

    resetEverything() {
      mutate(() => createInitialData())
    },
  }
})

// --- selectors -------------------------------------------------------------

export function activeProfileOf(data: AppData): Profile | undefined {
  return data.profiles.find((profile) => profile.id === data.activeProfileId) ?? data.profiles[0]
}

export function activeWebmixOf(data: AppData): Webmix | undefined {
  const profile = activeProfileOf(data)
  if (!profile) return undefined
  return (
    profile.webmixes.find((webmix) => webmix.id === profile.activeWebmixId) ?? profile.webmixes[0]
  )
}

export const useActiveProfile = () => useStore((state) => activeProfileOf(state.data))
export const useActiveWebmix = () => useStore((state) => activeWebmixOf(state.data))
export const useSettings = () => useStore((state) => state.data.settings)

// --- helpers ---------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function replaceProfile(data: AppData, profile: Profile): AppData {
  return {
    ...data,
    profiles: data.profiles.map((candidate) =>
      candidate.id === profile.id ? profile : candidate,
    ),
  }
}

function replaceWebmix(data: AppData, profileId: string, webmix: Webmix): AppData {
  return {
    ...data,
    profiles: data.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            webmixes: profile.webmixes.map((candidate) =>
              candidate.id === webmix.id ? webmix : candidate,
            ),
          }
        : profile,
    ),
  }
}

// --- persistence -----------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | undefined
let lastSaved: AppData | null = null

useStore.subscribe((state, previous) => {
  if (state.status !== 'ready' || state.data === previous.data) return
  // Do not try to save while sitting at the passcode gate — there is no
  // credential, and the on-screen data is just the placeholder initial doc.
  if (state.authState === 'required') return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { data } = useStore.getState()
    if (data === lastSaved) return
    adapter
      .save(data)
      .then(() => {
        lastSaved = data
      })
      .catch((error: unknown) => {
        if (error instanceof AuthRequiredError) {
          // The session expired mid-edit. Return to the gate rather than
          // spamming save failures; the user re-enters the passcode to resume.
          useStore.setState({ authState: 'required' })
          useStore.getState().notify('Your session expired — please sign in again.', 'error')
          return
        }
        useStore
          .getState()
          .notify(
            error instanceof StorageError ? error.message : 'Could not save your changes.',
            'error',
          )
      })
  }, SAVE_DEBOUNCE_MS)
})
