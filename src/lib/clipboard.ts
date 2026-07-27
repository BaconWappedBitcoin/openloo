/**
 * Copy text to the clipboard, resiliently.
 *
 * `navigator.clipboard` only exists in a secure context (https or localhost).
 * A self-hosted OpenLoo reached over plain http on a LAN or Tailscale address
 * is *not* secure, so the modern API is unavailable there. Fall back to a
 * hidden textarea + `execCommand('copy')`, which still works in that case.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy path.
    }
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
