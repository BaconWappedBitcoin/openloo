/** Trigger a browser download of a JSON payload. */
export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Open a file picker and return the selected file's text. */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        resolve(await file.text())
      } catch {
        resolve(null)
      }
    }
    // A cancelled picker never fires `change`; the promise simply never settles,
    // which is fine because the caller has nothing to clean up.
    input.click()
  })
}

/** Date stamp for backup filenames, e.g. `2026-07-27`. */
export function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
