/**
 * Core data model.
 *
 * Everything the app persists is reachable from `AppData`. Keep this file free of
 * React and DOM imports so the storage layer and tests can use it in isolation.
 */

export type IconSpec =
  /** Render the first letters of the title on the tile colour. */
  | { kind: 'letter' }
  /** Fetch the site's favicon through the configured provider (off by default). */
  | { kind: 'favicon' }
  /** An explicit image URL, or a `data:` URI for an uploaded image. */
  | { kind: 'url'; src: string }
  /** A single emoji glyph. */
  | { kind: 'emoji'; char: string }

export interface Tile {
  id: string
  title: string
  url: string
  /** Column of the tile's top-left cell, 0-based. */
  x: number
  /** Row of the tile's top-left cell, 0-based. */
  y: number
  /** Width in cells. */
  w: number
  /** Height in cells. */
  h: number
  /** CSS colour for the tile background. */
  color: string
  icon: IconSpec
  openInNewTab: boolean
}

export interface Webmix {
  id: string
  name: string
  cols: number
  rows: number
  tiles: Tile[]
  createdAt: number
  updatedAt: number
}

/**
 * A local profile: a named set of webmixes living on this device.
 *
 * This is deliberately *not* an account — there is no server and no
 * authentication. Profiles let one browser hold several independent
 * dashboards (work / home / a kid's set of links).
 */
export interface Profile {
  id: string
  name: string
  webmixes: Webmix[]
  activeWebmixId: string
}

export type ThemeMode = 'light' | 'dark' | 'auto'

/** Which third party, if any, is allowed to see the domains you bookmark. */
export type IconProvider = 'none' | 'duckduckgo' | 'google'

export interface Settings {
  theme: ThemeMode
  /** Id from `SEARCH_ENGINES`, or `custom`. */
  searchEngineId: string
  /** Template containing `%s`, used when `searchEngineId === 'custom'`. */
  customSearchUrl: string
  iconProvider: IconProvider
  showSearch: boolean
  /** Tile corner radius in pixels. */
  tileRadius: number
  /** Gap between cells in pixels. */
  gap: number
}

export interface AppData {
  version: 1
  profiles: Profile[]
  activeProfileId: string
  settings: Settings
}

export const CURRENT_VERSION = 1 as const

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  searchEngineId: 'duckduckgo',
  customSearchUrl: '',
  iconProvider: 'none',
  showSearch: true,
  tileRadius: 14,
  gap: 8,
}

/** Grid bounds. Kept small enough that a board still fits a laptop screen. */
export const GRID_LIMITS = {
  minCols: 2,
  maxCols: 16,
  minRows: 2,
  maxRows: 12,
} as const
