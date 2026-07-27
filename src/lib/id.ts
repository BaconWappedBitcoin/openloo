/** Short, collision-resistant ids. Uses `crypto` where available. */
export function newId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 12)
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(6))
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Non-secure fallback for exotic environments; ids are not security-relevant.
  return Math.random().toString(36).slice(2, 14)
}
