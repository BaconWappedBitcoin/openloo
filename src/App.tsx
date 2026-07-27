import { useCallback, useEffect, useState } from 'react'
import type { Webmix } from './types'
import { activeProfileOf, activeWebmixOf, useStore } from './store/useStore'
import { decodeWebmix, takeImportPayloadFromLocation } from './lib/share'
import { hostOf } from './lib/url'
import { LoginGate } from './components/LoginGate'
import { SetupGate } from './components/SetupGate'
import { Notices } from './components/Notices'
import { SettingsDialog } from './components/SettingsDialog'
import { ShareDialog } from './components/ShareDialog'
import { TileEditor, type TileDraft } from './components/TileEditor'
import { Toolbar } from './components/Toolbar'
import { Workspace } from './components/Workspace'
import { Button, Modal } from './components/Modal'

type Dialog =
  | { kind: 'none' }
  | { kind: 'tile'; draft: TileDraft }
  | { kind: 'settings' }
  | { kind: 'share' }
  | { kind: 'incoming'; webmix: Webmix }

export default function App() {
  const data = useStore((state) => state.data)
  const status = useStore((state) => state.status)
  const editMode = useStore((state) => state.editMode)
  const authState = useStore((state) => state.authState)
  const init = useStore((state) => state.init)
  const undo = useStore((state) => state.undo)
  const setEditMode = useStore((state) => state.setEditMode)
  const importWebmix = useStore((state) => state.importWebmix)
  const notify = useStore((state) => state.notify)

  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  const closeDialog = useCallback(() => setDialog({ kind: 'none' }), [])

  useEffect(() => {
    void init()
  }, [init])

  useTheme(data.settings.theme)

  // A shared link is untrusted input, so it is previewed and confirmed rather
  // than silently merged into the user's dashboard.
  useEffect(() => {
    const payload = takeImportPayloadFromLocation()
    if (!payload) return
    void decodeWebmix(payload).then((webmix) => {
      if (webmix) setDialog({ kind: 'incoming', webmix })
      else notify('That shared link could not be read.', 'error')
    })
  }, [notify])

  const profile = activeProfileOf(data)
  const webmix = activeWebmixOf(data)
  const dialogOpen = dialog.kind !== 'none'

  useKeyboardShortcuts({
    enabled: !dialogOpen,
    onSearch: () => document.querySelector<HTMLInputElement>('[data-search-input]')?.focus(),
    onToggleEdit: () => setEditMode(!editMode),
    onAddTile: () => setDialog({ kind: 'tile', draft: {} }),
    onUndo: undo,
  })

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
        Loading…
      </div>
    )
  }

  // A fresh synced instance with no passcode yet: show the setup screen.
  if (authState === 'setup') {
    return (
      <>
        <SetupGate />
        <Notices />
      </>
    )
  }

  // A synced instance that needs a passcode we do not hold: show the gate and
  // nothing else, so no board data is on screen before sign-in.
  if (authState === 'required') {
    return (
      <>
        <LoginGate />
        <Notices />
      </>
    )
  }

  if (!profile || !webmix) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        profiles={data.profiles}
        activeProfileId={profile.id}
        onOpenSettings={() => setDialog({ kind: 'settings' })}
        onOpenShare={() => setDialog({ kind: 'share' })}
        onAddTile={() => setDialog({ kind: 'tile', draft: {} })}
      />

      <Workspace
        profile={profile}
        webmix={webmix}
        settings={data.settings}
        editMode={editMode}
        onEditTile={(tile) => setDialog({ kind: 'tile', draft: { tile } })}
        onAddTileAt={(position) => setDialog({ kind: 'tile', draft: { position } })}
      />

      {editMode ? (
        <p className="pb-1 text-center text-xs text-[var(--color-ink-muted)]">
          Drag tiles to rearrange · click a tile to edit · drag onto a webmix tab to move it there
        </p>
      ) : null}

      {dialog.kind === 'tile' ? (
        <TileEditor
          draft={dialog.draft}
          maxW={webmix.cols}
          maxH={webmix.rows}
          onClose={closeDialog}
        />
      ) : null}

      {dialog.kind === 'settings' ? (
        <SettingsDialog
          webmix={webmix}
          profiles={data.profiles}
          activeProfileId={profile.id}
          onClose={closeDialog}
        />
      ) : null}

      {dialog.kind === 'share' ? (
        <ShareDialog webmix={webmix} data={data} onClose={closeDialog} />
      ) : null}

      {dialog.kind === 'incoming' ? (
        <IncomingWebmixDialog
          webmix={dialog.webmix}
          onCancel={closeDialog}
          onAccept={() => {
            importWebmix(dialog.webmix)
            notify(`Added "${dialog.webmix.name}".`)
            closeDialog()
          }}
        />
      ) : null}

      <Notices />
    </div>
  )
}

/**
 * Preview for a webmix arriving from a shared link.
 *
 * The destinations are listed by hostname so the recipient can see where the
 * tiles actually point before adding them — a tile labelled "Bank" can link
 * anywhere, and this is the moment to notice that.
 */
function IncomingWebmixDialog({
  webmix,
  onAccept,
  onCancel,
}: {
  webmix: Webmix
  onAccept(): void
  onCancel(): void
}) {
  const hosts = [...new Set(webmix.tiles.map((tile) => hostOf(tile.url) ?? '—'))]

  return (
    <Modal
      title="Someone shared a webmix with you"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onAccept}>
            Add to my dashboard
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        <strong>{webmix.name}</strong> — {webmix.tiles.length} tile
        {webmix.tiles.length === 1 ? '' : 's'}.
      </p>
      <p className="mb-2 text-xs text-[var(--color-ink-muted)]">
        These tiles link to the following sites. Check them before adding — a tile's label is
        chosen by whoever made it and need not match where it goes.
      </p>
      <ul className="max-h-56 overflow-y-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-xs">
        {hosts.map((host) => (
          <li key={host} className="py-0.5 font-mono">
            {host}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/** Applies the theme class, following the OS when set to `auto`. */
function useTheme(theme: 'light' | 'dark' | 'auto') {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme !== 'auto') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

interface ShortcutHandlers {
  enabled: boolean
  onSearch(): void
  onToggleEdit(): void
  onAddTile(): void
  onUndo(): void
}

function useKeyboardShortcuts({
  enabled,
  onSearch,
  onToggleEdit,
  onAddTile,
  onUndo,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (typing) return
        event.preventDefault()
        onUndo()
        return
      }

      if (typing || event.ctrlKey || event.metaKey || event.altKey) return

      switch (event.key) {
        case '/':
          event.preventDefault()
          onSearch()
          break
        case 'e':
          onToggleEdit()
          break
        case 'n':
          onAddTile()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, onSearch, onToggleEdit, onAddTile, onUndo])
}
