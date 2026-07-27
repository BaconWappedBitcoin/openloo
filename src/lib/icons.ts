/**
 * A curated set of icons to choose from.
 *
 * These are emoji rather than a bundled SVG icon font: they render everywhere
 * without shipping (or licensing) an asset library, they carry their own
 * colour, and they survive being packed into a share link as plain text. The
 * set is hand-picked and grouped so the picker reads as a deliberate palette
 * rather than a full emoji keyboard — the goal is "the right icon in two
 * clicks", not exhaustive coverage.
 */
export interface IconGroup {
  label: string
  icons: string[]
}

export const ICON_SET: IconGroup[] = [
  {
    label: 'Web',
    icons: ['🌐', '🔍', '⭐', '🔖', '📰', '🏠', '🗺️', '📡'],
  },
  {
    label: 'Talk',
    icons: ['✉️', '💬', '📞', '📇', '📣', '🔔', '👥', '🤝'],
  },
  {
    label: 'Media',
    icons: ['🎵', '🎧', '🎬', '📺', '📷', '📸', '🎨', '🎮', '🎙️', '📻'],
  },
  {
    label: 'Work',
    icons: ['📅', '✅', '📝', '📊', '📈', '📁', '🗂️', '📌', '⏰', '🗓️'],
  },
  {
    label: 'Tools',
    icons: ['💻', '🖥️', '⚙️', '🔧', '🐙', '☁️', '🔐', '🗄️', '🧰', '🖇️'],
  },
  {
    label: 'Shop',
    icons: ['🛒', '💳', '🏦', '💰', '🏷️', '📦', '🎁', '💸'],
  },
  {
    label: 'Learn',
    icons: ['📚', '📖', '🎓', '🧠', '🔬', '📓', '✏️', '🧭'],
  },
  {
    label: 'Life',
    icons: ['🍔', '☕', '✈️', '🚗', '⚽', '🌤️', '❤️', '🐾', '🌱', '🎉'],
  },
]

/** Flat list, handy for tests and search. */
export const ALL_ICONS: string[] = ICON_SET.flatMap((group) => group.icons)
