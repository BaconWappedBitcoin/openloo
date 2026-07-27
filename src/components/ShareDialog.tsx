import { useEffect, useState } from 'react'
import type { AppData, Webmix } from '../types'
import { buildShareUrl, encodeWebmix, SHARE_LENGTH_WARNING } from '../lib/share'
import { dateStamp, downloadJson, pickJsonFile } from '../lib/files'
import { copyText } from '../lib/clipboard'
import { sanitizeAppData, sanitizeWebmix } from '../lib/sanitize'
import { SYMBALOO_EXPORT_SNIPPET } from '../lib/symbaloo'
import { useStore } from '../store/useStore'
import { Button, inputClass, Modal } from './Modal'

interface ShareDialogProps {
  webmix: Webmix
  data: AppData
  onClose(): void
}

export function ShareDialog({ webmix, data, onClose }: ShareDialogProps) {
  const notify = useStore((state) => state.notify)
  const importWebmix = useStore((state) => state.importWebmix)
  const replaceAll = useStore((state) => state.replaceAll)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void encodeWebmix(webmix).then((payload) => {
      if (!cancelled) setShareUrl(buildShareUrl(payload))
    })
    return () => {
      cancelled = true
    }
  }, [webmix])

  async function copyLink() {
    if (!shareUrl) return
    const ok = await copyText(shareUrl)
    if (ok) notify('Link copied.')
    else notify('Could not copy — select the link and copy it.', 'error')
  }

  async function copySnippet() {
    const ok = await copyText(SYMBALOO_EXPORT_SNIPPET)
    if (ok) notify("Snippet copied — paste it into Symbaloo's console.")
    else notify('Could not copy — select the snippet text and copy it.', 'error')
  }

  async function importFile() {
    const text = await pickJsonFile()
    if (!text) return
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      notify('That file is not valid JSON.', 'error')
      return
    }

    // An array of Openmixes (e.g. the Symbaloo export): add each to the current
    // profile without touching anything else.
    if (Array.isArray(parsed)) {
      const mixes = parsed.map(sanitizeWebmix).filter((mix): mix is NonNullable<typeof mix> => mix !== null)
      if (mixes.length === 0) {
        notify('Could not read any Openmixes from that file.', 'error')
        return
      }
      mixes.forEach(importWebmix)
      notify(`Imported ${mixes.length} Openmix${mixes.length === 1 ? '' : 'es'}.`)
      onClose()
      return
    }

    // A full backup replaces everything (with confirmation).
    const backup = sanitizeAppData(parsed)
    if (backup) {
      if (
        confirm('Replace everything on this device with the contents of this backup? You can undo.')
      ) {
        replaceAll(backup)
        notify('Backup restored.')
        onClose()
      }
      return
    }

    // Otherwise a single exported Openmix.
    const single = sanitizeWebmix(parsed)
    if (single) {
      importWebmix(single)
      notify(`Imported "${single.name}".`)
      onClose()
      return
    }

    notify('Could not read any Openmixes from that file.', 'error')
  }

  const tooLong = shareUrl !== null && shareUrl.length > SHARE_LENGTH_WARNING

  return (
    <Modal title="Import, export &amp; share" onClose={onClose} wide>
      <section className="mb-6">
        <h3 className="mb-1 text-sm font-semibold">Export</h3>
        <p className="mb-2.5 text-xs text-[var(--color-ink-muted)]">
          Plain JSON. Nothing is uploaded anywhere.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadJson(`${slug(webmix.name)}-${dateStamp()}.json`, webmix)}>
            This Openmix
          </Button>
          <Button onClick={() => downloadJson(`openloo-backup-${dateStamp()}.json`, data)}>
            Everything (backup)
          </Button>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="mb-1 text-sm font-semibold">Import</h3>
        <p className="mb-2.5 text-xs text-[var(--color-ink-muted)]">
          Accepts either a single Openmix or a full backup. Imported data is validated first —
          tiles with unsafe addresses are dropped.
        </p>
        <Button onClick={() => void importFile()}>Choose a file…</Button>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Migrate from Symbaloo</h3>
        <p className="mb-2.5 text-xs text-[var(--color-ink-muted)]">
          Symbaloo has no export, so this pulls <strong>all your webmixes</strong> out from
          Symbaloo's own page and imports them here without touching your existing boards. Open
          Symbaloo in another tab, then:
        </p>
        <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-xs text-[var(--color-ink-muted)]">
          <li>On the Symbaloo tab, open the browser console (F12 → Console).</li>
          <li>
            Paste the snippet below and press Enter. It steps through each of your webmix tabs
            (the view will change as it does), then downloads one JSON file.
          </li>
          <li>
            Come back here and use <strong>Import → Choose a file…</strong> above to load it.
          </li>
        </ol>
        <textarea
          readOnly
          value={SYMBALOO_EXPORT_SNIPPET}
          onFocus={(event) => event.currentTarget.select()}
          rows={6}
          spellCheck={false}
          aria-label="Symbaloo export snippet"
          className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-2 font-mono text-[10px] leading-tight"
        />
        <p className="mt-1 text-[11px] text-[var(--color-ink-muted)]">
          Click the box to select all, or use the button. (If copy fails on an http instance,
          select the text and copy it manually.)
        </p>
        <Button className="mt-2" onClick={() => void copySnippet()}>
          Copy snippet
        </Button>
      </section>

      <section className="mt-6 border-t border-[var(--color-line)] pt-4">
        <h3 className="mb-1 text-sm font-semibold">Share “{webmix.name}” as a link</h3>
        <p className="mb-2.5 text-xs text-[var(--color-ink-muted)]">
          The whole Openmix is packed into the link itself — there is no server holding a copy.
          Anyone with the link can open it and add it to their own dashboard.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl ?? 'Preparing link…'}
            onFocus={(event) => event.currentTarget.select()}
            className={inputClass}
            aria-label="Shareable link"
          />
          <Button variant="primary" onClick={copyLink} disabled={!shareUrl}>
            Copy
          </Button>
        </div>
        {tooLong ? (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            This link is long ({shareUrl?.length.toLocaleString()} characters) because the Openmix
            has many tiles or an uploaded icon. Some chat apps will truncate it — exporting a file
            is more reliable.
          </p>
        ) : null}
      </section>
    </Modal>
  )
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'openmix'
  )
}
