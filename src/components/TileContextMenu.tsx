import { useEffect, useRef, type ReactNode } from 'react'
import type { Settings, Tile } from '../types'
import { buildSearchUrl } from '../lib/searchEngines'
import { useStore } from '../store/useStore'

export interface TileMenuState {
  tile: Tile
  x: number
  y: number
}

interface TileContextMenuProps {
  menu: TileMenuState
  settings: Settings
  onEdit(tile: Tile): void
  onClose(): void
}

const MENU_WIDTH = 200
const MENU_HEIGHT = 240

/** Right-click menu for a tile: open, copy, search, edit, delete. */
export function TileContextMenu({ menu, settings, onEdit, onClose }: TileContextMenuProps) {
  const removeTile = useStore((state) => state.removeTile)
  const notify = useStore((state) => state.notify)
  const ref = useRef<HTMLDivElement>(null)

  const { tile } = menu

  useEffect(() => {
    // Move focus into the menu so it can be dismissed and driven by keyboard.
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    // Any scroll or resize invalidates the anchored position; just close.
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // Keep the menu on screen when the click was near an edge.
  const left = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(menu.y, window.innerHeight - MENU_HEIGHT - 8)

  function openTile() {
    window.open(tile.url, tile.openInNewTab ? '_blank' : '_self', 'noopener,noreferrer')
    onClose()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(tile.url)
      notify('Link copied.')
    } catch {
      notify('Could not copy the link.', 'error')
    }
    onClose()
  }

  function searchWeb() {
    const url = buildSearchUrl(tile.title, settings.searchEngineId, settings.customSearchUrl)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else notify('Search engine is not configured. Check Settings.', 'error')
    onClose()
  }

  const searchLabel =
    tile.title.length > 22 ? `${tile.title.slice(0, 22)}…` : tile.title

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${tile.title}`}
      className="fixed z-[60] min-w-[180px] overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-raised)] py-1 text-sm shadow-2xl"
      style={{ left, top, width: MENU_WIDTH }}
    >
      <MenuItem onClick={openTile}>Open</MenuItem>
      <MenuItem onClick={() => void copyLink()}>Copy link</MenuItem>
      <MenuItem onClick={searchWeb}>Search for “{searchLabel}”</MenuItem>
      <div className="my-1 border-t border-[var(--color-line)]" />
      <MenuItem
        onClick={() => {
          onEdit(tile)
          onClose()
        }}
      >
        Edit
      </MenuItem>
      <MenuItem
        danger
        onClick={() => {
          removeTile(tile.id)
          onClose()
        }}
      >
        Delete
      </MenuItem>
    </div>
  )
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick(): void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left transition hover:bg-[var(--color-surface)] ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  )
}
