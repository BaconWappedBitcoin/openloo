import { useEffect, useState } from 'react'
import type { IconProvider, IconSpec, Tile } from '../types'
import { PALETTE } from '../lib/colors'
import { faviconUrl } from '../lib/favicon'
import { safeImageUrl, safeLinkUrl, suggestTitle } from '../lib/url'
import { useStore } from '../store/useStore'
import { IconPicker } from './IconPicker'
import { Button, Field, inputClass, Modal } from './Modal'

/** Uploaded icons live in localStorage, so keep them small. */
const MAX_ICON_BYTES = 80_000

export interface TileDraft {
  tile?: Tile
  position?: { x: number; y: number }
}

interface TileEditorProps {
  draft: TileDraft
  maxW: number
  maxH: number
  onClose(): void
}

export function TileEditor({ draft, maxW, maxH, onClose }: TileEditorProps) {
  const existing = draft.tile
  const addTile = useStore((state) => state.addTile)
  const updateTile = useStore((state) => state.updateTile)
  const removeTile = useStore((state) => state.removeTile)
  const setTileSize = useStore((state) => state.setTileSize)
  const notify = useStore((state) => state.notify)
  const iconProvider = useStore((state) => state.data.settings.iconProvider)
  const updateSettings = useStore((state) => state.updateSettings)

  const [url, setUrl] = useState(existing?.url ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[7])
  const [icon, setIcon] = useState<IconSpec>(existing?.icon ?? { kind: 'letter' })
  const [openInNewTab, setOpenInNewTab] = useState(existing?.openInNewTab ?? false)
  const [size, setSize] = useState({ w: existing?.w ?? 1, h: existing?.h ?? 1 })
  const [urlError, setUrlError] = useState<string | null>(null)

  // Offer a title derived from the domain, but never overwrite what was typed.
  useEffect(() => {
    if (title.trim() === '' && url.trim() !== '') {
      const suggestion = suggestTitle(url)
      if (suggestion) setTitle(suggestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  function onSave() {
    const safeUrl = safeLinkUrl(url)
    if (!safeUrl) {
      setUrlError('Enter a valid http:// or https:// address.')
      return
    }

    if (existing) {
      updateTile(existing.id, { url: safeUrl, title: title.trim() || 'Untitled', color, icon, openInNewTab })
      if (size.w !== existing.w || size.h !== existing.h) {
        setTileSize(existing.id, size.w, size.h)
      }
    } else {
      addTile({
        url: safeUrl,
        title: title.trim() || 'Untitled',
        color,
        icon,
        openInNewTab,
        w: size.w,
        h: size.h,
        ...draft.position,
      })
    }
    onClose()
  }

  async function onUploadIcon(file: File) {
    if (!file.type.startsWith('image/')) {
      notify('That file is not an image.', 'error')
      return
    }
    if (file.size > MAX_ICON_BYTES) {
      notify(`Icon must be under ${Math.round(MAX_ICON_BYTES / 1000)} KB.`, 'error')
      return
    }
    const dataUrl = await readAsDataUrl(file)
    const safe = dataUrl ? safeImageUrl(dataUrl) : null
    if (!safe) {
      notify('That image format is not supported. Try PNG, JPEG or WebP.', 'error')
      return
    }
    setIcon({ kind: 'url', src: safe })
  }

  return (
    <Modal
      title={existing ? 'Edit tile' : 'Add tile'}
      onClose={onClose}
      footer={
        <>
          {existing ? (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                removeTile(existing.id)
                onClose()
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave}>
            {existing ? 'Save' : 'Add tile'}
          </Button>
        </>
      }
    >
      <Field label="Address">
        <input
          className={inputClass}
          value={url}
          onChange={(event) => {
            setUrl(event.target.value)
            setUrlError(null)
          }}
          onKeyDown={(event) => event.key === 'Enter' && onSave()}
          placeholder="example.com"
          inputMode="url"
          autoComplete="off"
          aria-invalid={urlError !== null}
        />
        {urlError ? <span className="mt-1.5 block text-xs text-red-500">{urlError}</span> : null}
      </Field>

      <Field label="Label">
        <input
          className={inputClass}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onSave()}
          placeholder="Shown on the tile"
          maxLength={120}
        />
      </Field>

      <Field label="Colour">
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Use colour ${swatch}`}
              aria-pressed={color === swatch}
              className={`h-7 w-7 rounded-full transition ${
                color === swatch ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              }`}
              style={{ background: swatch }}
            />
          ))}
          <label className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2 text-xs">
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
              aria-label="Custom colour"
            />
            Custom
          </label>
        </div>
      </Field>

      <Field label="Icon">
        <div className="flex flex-wrap gap-2">
          <IconChoice active={icon.kind === 'letter'} onClick={() => setIcon({ kind: 'letter' })}>
            Initials
          </IconChoice>
          <IconChoice active={icon.kind === 'favicon'} onClick={() => setIcon({ kind: 'favicon' })}>
            Favicon
          </IconChoice>
          <IconChoice
            active={icon.kind === 'emoji'}
            onClick={() =>
              setIcon({ kind: 'emoji', char: icon.kind === 'emoji' ? icon.char : '⭐' })
            }
          >
            Choose icon
          </IconChoice>
          <label className="cursor-pointer rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface)]">
            Upload…
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onUploadIcon(file)
              }}
            />
          </label>
        </div>

        {icon.kind === 'favicon' ? (
          <FaviconPreview
            url={url}
            provider={iconProvider}
            onEnableProvider={() => updateSettings({ iconProvider: 'duckduckgo' })}
          />
        ) : null}

        {icon.kind === 'emoji' ? (
          <IconPicker
            selected={icon.char}
            onPick={(char) => setIcon({ kind: 'emoji', char })}
          />
        ) : null}

        {icon.kind === 'url' ? (
          <div className="mt-2 flex items-center gap-2">
            <img src={icon.src} alt="" className="h-8 w-8 rounded object-contain" />
            <button
              type="button"
              onClick={() => setIcon({ kind: 'letter' })}
              className="text-xs text-[var(--color-ink-muted)] underline"
            >
              Remove image
            </button>
          </div>
        ) : null}
      </Field>

      <Field label="Size">
        <div className="flex flex-wrap gap-2">
          {SIZES.filter(({ w, h }) => w <= maxW && h <= maxH).map(({ w, h, label }) => (
            <IconChoice
              key={label}
              active={size.w === w && size.h === h}
              onClick={() => setSize({ w, h })}
            >
              {label}
            </IconChoice>
          ))}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={openInNewTab}
          onChange={(event) => setOpenInNewTab(event.target.checked)}
        />
        Open in a new tab
      </label>
    </Modal>
  )
}

const SIZES = [
  { w: 1, h: 1, label: '1 × 1' },
  { w: 2, h: 1, label: '2 × 1' },
  { w: 1, h: 2, label: '1 × 2' },
  { w: 2, h: 2, label: '2 × 2' },
  { w: 3, h: 2, label: '3 × 2' },
]

function IconChoice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-300'
          : 'border-[var(--color-line)] hover:bg-[var(--color-surface)]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Live favicon preview inside the tile editor.
 *
 * Favicon lookup is a third-party request that reveals which sites you
 * bookmark, so it stays off by default. Rather than silently falling back to
 * initials — which reads as "the feature is broken" — this states the
 * trade-off and offers to turn it on right here, so the choice is informed and
 * one click away instead of buried in Settings.
 */
function FaviconPreview({
  url,
  provider,
  onEnableProvider,
}: {
  url: string
  provider: IconProvider
  onEnableProvider(): void
}) {
  const [failed, setFailed] = useState(false)
  const src = safeLinkUrl(url) ? faviconUrl(url, provider) : null

  // Re-attempt the image whenever the address or provider changes.
  useEffect(() => setFailed(false), [url, provider])

  if (provider === 'none') {
    return (
      <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-xs">
        <p className="mb-2 text-[var(--color-ink-muted)]">
          Favicon lookup is off for privacy — fetching an icon tells the provider
          which sites you bookmark. Turn it on to show real site icons.
        </p>
        <Button onClick={onEnableProvider}>Enable via DuckDuckGo</Button>
      </div>
    )
  }

  if (!src) {
    return (
      <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
        Enter a valid address above to preview its favicon.
      </p>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      {failed ? (
        <span className="text-xs text-[var(--color-ink-muted)]">
          No favicon found for this site — tiles will fall back to initials.
        </span>
      ) : (
        <>
          <img
            src={src}
            alt=""
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-8 w-8 rounded object-contain"
          />
          <span className="text-xs text-[var(--color-ink-muted)]">
            Live icon from {provider === 'duckduckgo' ? 'DuckDuckGo' : 'Google'}.
          </span>
        </>
      )}
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}
