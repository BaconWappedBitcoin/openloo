import {
  CURRENT_VERSION,
  DEFAULT_SETTINGS,
  type AppData,
  type Profile,
  type Tile,
  type Webmix,
} from '../types'
import { colorForSeed } from './colors'
import { newId } from './id'

interface Seed {
  title: string
  url: string
  color?: string
}

/**
 * A starter board. Deliberately generic and vendor-neutral — enough to show
 * what the grid does without pushing anyone's services.
 */
const STARTER: Seed[] = [
  { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
  { title: 'Archive.org', url: 'https://archive.org' },
  { title: 'GitHub', url: 'https://github.com' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com' },
  { title: 'MDN', url: 'https://developer.mozilla.org' },
  { title: 'Project Gutenberg', url: 'https://www.gutenberg.org' },
  { title: 'Wolfram Alpha', url: 'https://www.wolframalpha.com' },
  { title: 'Unsplash', url: 'https://unsplash.com' },
]

export function createTile(partial: Partial<Tile> & { url: string }): Tile {
  return {
    id: newId(),
    title: partial.title ?? 'Untitled',
    url: partial.url,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    w: partial.w ?? 1,
    h: partial.h ?? 1,
    color: partial.color ?? colorForSeed(partial.url),
    icon: partial.icon ?? { kind: 'letter' },
    openInNewTab: partial.openInNewTab ?? false,
  }
}

export function createWebmix(name = 'My webmix', cols = 9, rows = 6): Webmix {
  const now = Date.now()
  return { id: newId(), name, cols, rows, tiles: [], createdAt: now, updatedAt: now }
}

function starterWebmix(): Webmix {
  const webmix = createWebmix('Start')
  webmix.tiles = STARTER.map((seed, index) =>
    createTile({
      ...seed,
      x: index % webmix.cols,
      y: Math.floor(index / webmix.cols),
    }),
  )
  return webmix
}

export function createProfile(name = 'Default', withStarter = false): Profile {
  const webmix = withStarter ? starterWebmix() : createWebmix()
  return { id: newId(), name, webmixes: [webmix], activeWebmixId: webmix.id }
}

/** The document a brand-new install starts from. */
export function createInitialData(): AppData {
  const profile = createProfile('Default', true)
  return {
    version: CURRENT_VERSION,
    profiles: [profile],
    activeProfileId: profile.id,
    settings: { ...DEFAULT_SETTINGS },
  }
}
