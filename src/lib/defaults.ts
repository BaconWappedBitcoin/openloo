import {
  CURRENT_VERSION,
  DEFAULT_SETTINGS,
  type AppData,
  type IconSpec,
  type Profile,
  type Tile,
  type Webmix,
} from '../types'
import { colorForSeed } from './colors'
import { newId } from './id'

interface Seed {
  title: string
  url: string
  icon?: IconSpec
  color?: string
  w?: number
  h?: number
}

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
    openInNewTab: partial.openInNewTab ?? true,
  }
}

export function createWebmix(name = 'My webmix', cols = 9, rows = 6): Webmix {
  const now = Date.now()
  return { id: newId(), name, cols, rows, tiles: [], createdAt: now, updatedAt: now }
}

/** Lay seeds out left-to-right, top-to-bottom, skipping cells a wide/tall tile covers. */
function layout(name: string, seeds: Seed[], cols = 9, rows = 6): Webmix {
  const webmix = createWebmix(name, cols, rows)
  const taken = new Set<string>()
  const fits = (x: number, y: number, w: number, h: number) => {
    if (x + w > cols || y + h > rows) return false
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) if (taken.has(`${x + dx}:${y + dy}`)) return false
    return true
  }
  const claim = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) taken.add(`${x + dx}:${y + dy}`)
  }

  for (const seed of seeds) {
    const w = seed.w ?? 1
    const h = seed.h ?? 1
    let placed = false
    for (let y = 0; y < rows && !placed; y++) {
      for (let x = 0; x < cols && !placed; x++) {
        if (fits(x, y, w, h)) {
          claim(x, y, w, h)
          webmix.tiles.push(createTile({ ...seed, x, y, w, h }))
          placed = true
        }
      }
    }
  }
  return webmix
}

const FAVICON: IconSpec = { kind: 'favicon' }
const emoji = (char: string): IconSpec => ({ kind: 'emoji', char })

/**
 * The privacy-first starter shown on a real (self-hosted) install.
 *
 * Deliberately small and vendor-neutral, with letter icons so it makes no
 * third-party requests out of the box.
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

/**
 * The public demo's content — richer and categorised, with real favicons, so a
 * first-time visitor sees what a filled-in dashboard looks like. This is only
 * used when built with VITE_DEMO=1 (the GitHub Pages build); it also flips the
 * favicon provider on, which a real install leaves off for privacy.
 */
const DEMO_WEBMIXES: { name: string; seeds: Seed[] }[] = [
  {
    name: 'Start',
    seeds: [
      { title: 'Search', url: 'https://duckduckgo.com', icon: emoji('🔍'), w: 2, h: 2 },
      { title: 'Wikipedia', url: 'https://www.wikipedia.org', icon: FAVICON },
      { title: 'GitHub', url: 'https://github.com', icon: FAVICON },
      { title: 'Hacker News', url: 'https://news.ycombinator.com', icon: FAVICON },
      { title: 'Reddit', url: 'https://www.reddit.com', icon: FAVICON },
      { title: 'YouTube', url: 'https://www.youtube.com', icon: FAVICON },
      { title: 'Mastodon', url: 'https://joinmastodon.org', icon: FAVICON },
      { title: 'Maps', url: 'https://www.openstreetmap.org', icon: emoji('🗺️') },
      { title: 'Weather', url: 'https://wttr.in', icon: emoji('🌤️') },
      { title: 'Mail', url: 'https://mail.proton.me', icon: FAVICON },
      { title: 'Calendar', url: 'https://calendar.google.com', icon: emoji('📅') },
      { title: 'News', url: 'https://apnews.com', icon: FAVICON },
      { title: 'Archive', url: 'https://archive.org', icon: FAVICON },
      { title: 'Wolfram', url: 'https://www.wolframalpha.com', icon: FAVICON },
    ],
  },
  {
    name: 'Dev',
    seeds: [
      { title: 'GitHub', url: 'https://github.com', icon: FAVICON, w: 2, h: 2 },
      { title: 'MDN', url: 'https://developer.mozilla.org', icon: FAVICON },
      { title: 'Stack Overflow', url: 'https://stackoverflow.com', icon: FAVICON },
      { title: 'npm', url: 'https://www.npmjs.com', icon: FAVICON },
      { title: 'Codeberg', url: 'https://codeberg.org', icon: FAVICON },
      { title: 'Rust', url: 'https://www.rust-lang.org', icon: FAVICON },
      { title: 'Python', url: 'https://www.python.org', icon: FAVICON },
      { title: 'Node.js', url: 'https://nodejs.org', icon: FAVICON },
      { title: 'TypeScript', url: 'https://www.typescriptlang.org', icon: FAVICON },
      { title: 'Docker', url: 'https://www.docker.com', icon: FAVICON },
      { title: 'Dev.to', url: 'https://dev.to', icon: FAVICON },
      { title: 'Docs', url: 'https://devdocs.io', icon: emoji('📚') },
    ],
  },
  {
    name: 'Media',
    seeds: [
      { title: 'YouTube', url: 'https://www.youtube.com', icon: FAVICON, w: 2, h: 2 },
      { title: 'Bandcamp', url: 'https://bandcamp.com', icon: FAVICON },
      { title: 'SoundCloud', url: 'https://soundcloud.com', icon: FAVICON },
      { title: 'Twitch', url: 'https://www.twitch.tv', icon: FAVICON },
      { title: 'Vimeo', url: 'https://vimeo.com', icon: FAVICON },
      { title: 'Letterboxd', url: 'https://letterboxd.com', icon: FAVICON },
      { title: 'Podcasts', url: 'https://podcastindex.org', icon: emoji('🎙️') },
      { title: 'Radio', url: 'https://radio.garden', icon: emoji('📻') },
      { title: 'Music', url: 'https://musicbrainz.org', icon: emoji('🎵') },
      { title: 'Photos', url: 'https://unsplash.com', icon: emoji('📷') },
    ],
  },
  {
    name: 'Learn',
    seeds: [
      { title: 'Wikipedia', url: 'https://www.wikipedia.org', icon: FAVICON, w: 2, h: 2 },
      { title: 'Gutenberg', url: 'https://www.gutenberg.org', icon: emoji('📖') },
      { title: 'Khan Academy', url: 'https://www.khanacademy.org', icon: FAVICON },
      { title: 'arXiv', url: 'https://arxiv.org', icon: FAVICON },
      { title: 'MIT OCW', url: 'https://ocw.mit.edu', icon: FAVICON },
      { title: 'Wolfram', url: 'https://www.wolframalpha.com', icon: FAVICON },
      { title: 'Wiktionary', url: 'https://www.wiktionary.org', icon: FAVICON },
      { title: 'Coursera', url: 'https://www.coursera.org', icon: FAVICON },
      { title: 'Brilliant', url: 'https://brilliant.org', icon: emoji('🧠') },
      { title: 'Maps', url: 'https://www.openstreetmap.org', icon: emoji('🧭') },
    ],
  },
]

export function createWebmixFromSeeds(name: string, seeds: Seed[]): Webmix {
  return layout(name, seeds)
}

export function createProfile(name = 'Default', variant: 'empty' | 'starter' | 'demo' = 'empty'): Profile {
  let webmixes: Webmix[]
  if (variant === 'demo') {
    webmixes = DEMO_WEBMIXES.map(({ name: mixName, seeds }) => layout(mixName, seeds))
  } else if (variant === 'starter') {
    webmixes = [layout('Start', STARTER)]
  } else {
    webmixes = [createWebmix()]
  }
  return { id: newId(), name, webmixes, activeWebmixId: webmixes[0].id }
}

/** True when built for the public demo (GitHub Pages), via `VITE_DEMO=1`. */
const IS_DEMO = import.meta.env.VITE_DEMO === '1'

/** The document a brand-new install starts from. */
export function createInitialData(): AppData {
  const profile = createProfile('Default', IS_DEMO ? 'demo' : 'starter')
  return {
    version: CURRENT_VERSION,
    profiles: [profile],
    activeProfileId: profile.id,
    settings: {
      ...DEFAULT_SETTINGS,
      // The demo shows real favicons; a real install stays request-free until
      // the user opts in.
      iconProvider: IS_DEMO ? 'duckduckgo' : DEFAULT_SETTINGS.iconProvider,
    },
  }
}
