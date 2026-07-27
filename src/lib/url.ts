/**
 * URL handling.
 *
 * OpenLoo renders webmixes that can arrive from an untrusted place — a shared
 * link or an imported JSON file. Every URL that ends up in an `href` or an
 * `img src` must pass through here first, so a `javascript:` or `data:text/html`
 * payload can never be turned into a clickable tile.
 */

const SAFE_LINK_SCHEMES = new Set(['http:', 'https:'])
const SAFE_IMAGE_SCHEMES = new Set(['http:', 'https:'])

/** Add a scheme to bare input like `example.com/path` so `new URL` succeeds. */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Returns the URL if it is a safe http(s) link, otherwise `null`. */
export function safeLinkUrl(input: string): string | null {
  try {
    const url = new URL(normalizeUrl(input))
    return SAFE_LINK_SCHEMES.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Returns the URL if it is safe to use as an `<img src>`.
 *
 * `data:image/*` is permitted because that is how uploaded icons are stored,
 * but `data:text/html` and `data:image/svg+xml` are not — SVG can carry script.
 */
export function safeImageUrl(input: string): string | null {
  const trimmed = input.trim()
  if (/^data:image\/(png|jpeg|jpg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed
  }
  try {
    const url = new URL(normalizeUrl(trimmed))
    return SAFE_IMAGE_SCHEMES.has(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/** Hostname without a `www.` prefix, or `null` if the URL is unusable. */
export function hostOf(input: string): string | null {
  try {
    return new URL(normalizeUrl(input)).hostname.replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** A short human label for a URL, used to prefill the title field. */
export function suggestTitle(input: string): string {
  const host = hostOf(input)
  if (!host) return ''
  const bare = host.split('.').slice(0, -1).join('.') || host
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}
