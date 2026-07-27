/** Tile palette — saturated enough to read as a colour block, dark enough for white text. */
export const PALETTE = [
  '#e5484d', // red
  '#e5533d', // vermilion
  '#f76b15', // orange
  '#ffb224', // amber
  '#46a758', // green
  '#12a594', // teal
  '#00a2c7', // cyan
  '#0091ff', // blue
  '#3e63dd', // indigo
  '#6e56cf', // violet
  '#8e4ec6', // purple
  '#d6409f', // pink
  '#64748b', // slate
  '#1f2937', // graphite
] as const

/** Deterministic colour choice so a given URL always gets the same tile hue. */
export function colorForSeed(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/**
 * Pick black or white text for a background colour using the WCAG relative
 * luminance formula, so custom colours stay readable.
 */
export function readableTextColor(background: string): string {
  const rgb = parseHex(background)
  if (!rgb) return '#ffffff'
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.45 ? '#111827' : '#ffffff'
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  let hex = match[1]
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('')
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}
