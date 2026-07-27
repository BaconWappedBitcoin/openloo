import {
  CURRENT_VERSION,
  DEFAULT_SETTINGS,
  GRID_LIMITS,
  type AppData,
  type IconProvider,
  type IconSpec,
  type Profile,
  type Settings,
  type ThemeMode,
  type Tile,
  type Webmix,
} from '../types'
import { newId } from './id'
import { colorForSeed, PALETTE } from './colors'
import { canPlace, findFreeSpot, rectOf } from './grid'
import { safeImageUrl, safeLinkUrl } from './url'

/**
 * Validation for data that did not come from our own UI: shared links,
 * imported files, and localStorage written by an older or tampered-with build.
 *
 * The rule throughout is *drop, do not throw*. A single malformed tile should
 * cost you that tile, not the whole import. Anything unrecognised is discarded
 * rather than passed through, so a hostile payload cannot smuggle fields into
 * the model.
 */

const MAX_TITLE = 120
const MAX_NAME = 60
const MAX_TILES = 400
const MAX_WEBMIXES = 60
const MAX_PROFILES = 20

function isControlChar(cp: number): boolean {
  return (
    cp < 0x20 || // C0 controls
    cp === 0x7f || // DEL
    (cp >= 0x202a && cp <= 0x202e) || // bidi embedding/override
    (cp >= 0x2066 && cp <= 0x2069) // bidi isolates
  )
}

/**
 * Trim a string to a maximum length, dropping control and bidi-override
 * characters. Bidi overrides matter here: they can make a hostile tile title
 * render as something entirely different from the text that was stored.
 */
function str(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  let out = ''
  for (const ch of value) {
    if (!isControlChar(ch.codePointAt(0)!)) out += ch
  }
  return out.trim().slice(0, max)
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number.NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function color(value: unknown, seed: string): string {
  if (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) {
    return value.trim()
  }
  return colorForSeed(seed)
}

function icon(value: unknown): IconSpec {
  if (!value || typeof value !== 'object') return { kind: 'letter' }
  const spec = value as Record<string, unknown>
  switch (spec.kind) {
    case 'favicon':
      return { kind: 'favicon' }
    case 'emoji': {
      const char = str(spec.char, 8)
      return char ? { kind: 'emoji', char } : { kind: 'letter' }
    }
    case 'url': {
      const src = typeof spec.src === 'string' ? safeImageUrl(spec.src) : null
      return src ? { kind: 'url', src } : { kind: 'letter' }
    }
    default:
      return { kind: 'letter' }
  }
}

function sanitizeTile(value: unknown, cols: number, rows: number): Tile | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  const url = typeof raw.url === 'string' ? safeLinkUrl(raw.url) : null
  // A tile with no reachable destination is not worth keeping.
  if (!url) return null

  const title = str(raw.title, MAX_TITLE) || 'Untitled'
  return {
    id: str(raw.id, 40) || newId(),
    title,
    url,
    x: int(raw.x, 0, cols - 1, 0),
    y: int(raw.y, 0, rows - 1, 0),
    w: int(raw.w, 1, cols, 1),
    h: int(raw.h, 1, rows, 1),
    color: color(raw.color, url),
    icon: icon(raw.icon),
    openInNewTab: bool(raw.openInNewTab, true),
  }
}

/**
 * Place sanitized tiles onto the grid, resolving overlaps that the source data
 * may have contained. Tiles keep their stated position when it is free and are
 * relocated to the first open slot when it is not.
 */
function placeTiles(candidates: Tile[], cols: number, rows: number): Tile[] {
  const placed: Tile[] = []
  for (const tile of candidates.slice(0, MAX_TILES)) {
    const clamped: Tile = {
      ...tile,
      w: Math.min(tile.w, cols),
      h: Math.min(tile.h, rows),
    }
    if (canPlace(placed, rectOf(clamped), cols, rows)) {
      placed.push(clamped)
      continue
    }
    const spot = findFreeSpot(placed, cols, rows, clamped.w, clamped.h)
    if (spot) placed.push({ ...clamped, x: spot.x, y: spot.y })
  }
  return placed
}

export function sanitizeWebmix(value: unknown): Webmix | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  const cols = int(raw.cols, GRID_LIMITS.minCols, GRID_LIMITS.maxCols, 9)
  const rows = int(raw.rows, GRID_LIMITS.minRows, GRID_LIMITS.maxRows, 6)

  const rawTiles = Array.isArray(raw.tiles) ? raw.tiles : []
  const tiles = placeTiles(
    rawTiles
      .map((tile) => sanitizeTile(tile, cols, rows))
      .filter((tile): tile is Tile => tile !== null),
    cols,
    rows,
  )

  const now = Date.now()
  return {
    id: str(raw.id, 40) || newId(),
    name: str(raw.name, MAX_NAME) || 'Openmix',
    cols,
    rows,
    tiles,
    createdAt: int(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, now),
    updatedAt: int(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER, now),
  }
}

export function sanitizeProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  const rawMixes = Array.isArray(raw.webmixes) ? raw.webmixes.slice(0, MAX_WEBMIXES) : []
  const webmixes = rawMixes
    .map(sanitizeWebmix)
    .filter((webmix): webmix is Webmix => webmix !== null)

  if (webmixes.length === 0) return null

  const requested = str(raw.activeWebmixId, 40)
  const activeWebmixId = webmixes.some((webmix) => webmix.id === requested)
    ? requested
    : webmixes[0].id

  return {
    id: str(raw.id, 40) || newId(),
    name: str(raw.name, MAX_NAME) || 'Default',
    webmixes,
    activeWebmixId,
  }
}

function sanitizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS }
  const raw = value as Record<string, unknown>

  const themes: ThemeMode[] = ['light', 'dark', 'auto']
  const providers: IconProvider[] = ['none', 'duckduckgo', 'google']

  return {
    theme: themes.includes(raw.theme as ThemeMode)
      ? (raw.theme as ThemeMode)
      : DEFAULT_SETTINGS.theme,
    searchEngineId: str(raw.searchEngineId, 30) || DEFAULT_SETTINGS.searchEngineId,
    customSearchUrl: str(raw.customSearchUrl, 300),
    iconProvider: providers.includes(raw.iconProvider as IconProvider)
      ? (raw.iconProvider as IconProvider)
      : DEFAULT_SETTINGS.iconProvider,
    showSearch: bool(raw.showSearch, DEFAULT_SETTINGS.showSearch),
    tileRadius: int(raw.tileRadius, 0, 40, DEFAULT_SETTINGS.tileRadius),
    gap: int(raw.gap, 0, 32, DEFAULT_SETTINGS.gap),
  }
}

/** Validate a whole persisted document. Returns `null` if nothing survives. */
export function sanitizeAppData(value: unknown): AppData | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>

  const rawProfiles = Array.isArray(raw.profiles) ? raw.profiles.slice(0, MAX_PROFILES) : []
  const profiles = rawProfiles
    .map(sanitizeProfile)
    .filter((profile): profile is Profile => profile !== null)

  if (profiles.length === 0) return null

  const requested = str(raw.activeProfileId, 40)
  const activeProfileId = profiles.some((profile) => profile.id === requested)
    ? requested
    : profiles[0].id

  return {
    version: CURRENT_VERSION,
    profiles,
    activeProfileId,
    settings: sanitizeSettings(raw.settings),
  }
}

export { PALETTE }
