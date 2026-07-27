import type { Webmix } from '../types'
import { sanitizeWebmix } from './sanitize'

/**
 * Share a webmix by putting it in the URL itself.
 *
 * With no server there is nowhere to store a shared board, so the board *is*
 * the link. The payload is deflated and base64url-encoded, and lives in the
 * hash fragment — hash fragments are never sent to the server, which keeps a
 * shared link private to whoever holds it even if the app is served from a
 * host you do not control.
 */

const COMPRESSED_PREFIX = 'z'
const RAW_PREFIX = 'r'

/** Links much beyond this get truncated by chat apps and some browsers. */
export const SHARE_LENGTH_WARNING = 8000

export async function encodeWebmix(webmix: Webmix): Promise<string> {
  const json = JSON.stringify(stripForSharing(webmix))
  const bytes = new TextEncoder().encode(json)
  const compressed = await deflate(bytes)
  return compressed
    ? COMPRESSED_PREFIX + base64UrlEncode(compressed)
    : RAW_PREFIX + base64UrlEncode(bytes)
}

export async function decodeWebmix(payload: string): Promise<Webmix | null> {
  try {
    const prefix = payload[0]
    const body = base64UrlDecode(payload.slice(1))
    const bytes =
      prefix === COMPRESSED_PREFIX
        ? await inflate(body)
        : prefix === RAW_PREFIX
          ? body
          : null
    if (!bytes) return null
    // Sanitized, not merely parsed: this data came from a link someone sent.
    return sanitizeWebmix(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

/** Drop fields a recipient does not need, keeping shared links short. */
function stripForSharing(webmix: Webmix) {
  return {
    name: webmix.name,
    cols: webmix.cols,
    rows: webmix.rows,
    tiles: webmix.tiles.map((tile) => ({
      title: tile.title,
      url: tile.url,
      x: tile.x,
      y: tile.y,
      w: tile.w,
      h: tile.h,
      color: tile.color,
      icon: tile.icon,
      openInNewTab: tile.openInNewTab,
    })),
  }
}

export function buildShareUrl(payload: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#import=${payload}`
}

/** Reads and clears an `#import=` payload from the current URL. */
export function takeImportPayloadFromLocation(): string | null {
  const match = /[#&]import=([A-Za-z0-9_-]+)/.exec(window.location.hash)
  if (!match) return null
  history.replaceState(null, '', window.location.pathname + window.location.search)
  return match[1]
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  // Chunked to stay well under the argument limit of String.fromCharCode.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
