import { useState } from 'react'
import type { Settings, Tile } from '../types'
import { readableTextColor } from '../lib/colors'
import { faviconUrl, initialsOf } from '../lib/favicon'
import { hostOf } from '../lib/url'

interface TileContentProps {
  tile: Tile
  settings: Settings
  /** Cell size in pixels, used to scale the label and icon. */
  cell: number
}

/** The coloured face of a tile: icon on top, label underneath. */
export function TileContent({ tile, settings, cell }: TileContentProps) {
  const [iconFailed, setIconFailed] = useState(false)
  const textColor = readableTextColor(tile.color)
  const width = tile.w * cell
  const height = tile.h * cell

  const iconSize = Math.round(Math.min(width, height) * 0.34)
  const labelSize = Math.max(9, Math.round(Math.min(width, height) * 0.13))

  const imageSrc =
    tile.icon.kind === 'url'
      ? tile.icon.src
      : tile.icon.kind === 'favicon'
        ? faviconUrl(tile.url, settings.iconProvider)
        : null

  const showImage = imageSrc !== null && !iconFailed

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 overflow-hidden px-1.5 text-center"
      style={{ color: textColor }}
    >
      {showImage ? (
        <img
          src={imageSrc}
          alt=""
          width={iconSize}
          height={iconSize}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setIconFailed(true)}
          style={{ width: iconSize, height: iconSize, objectFit: 'contain' }}
          className="drop-shadow-sm"
        />
      ) : tile.icon.kind === 'emoji' ? (
        <span style={{ fontSize: iconSize, lineHeight: 1 }}>{tile.icon.char}</span>
      ) : (
        <span
          style={{ fontSize: iconSize, lineHeight: 1 }}
          className="font-bold tracking-tight opacity-95"
        >
          {initialsOf(tile.title)}
        </span>
      )}

      <span
        style={{ fontSize: labelSize, lineHeight: 1.2 }}
        className="line-clamp-2 w-full font-medium break-words opacity-95"
      >
        {tile.title}
      </span>
    </div>
  )
}

interface TileFaceProps extends TileContentProps {
  radius: number
  /** Visual only — dragged tiles render dimmed in place. */
  dimmed?: boolean
  lifted?: boolean
}

export function TileFace({ radius, dimmed, lifted, ...content }: TileFaceProps) {
  return (
    <div
      className={`h-full w-full transition-shadow ${dimmed ? 'opacity-30' : ''} ${
        lifted ? 'shadow-2xl ring-2 ring-white/60' : 'shadow-sm'
      }`}
      style={{ background: content.tile.color, borderRadius: radius }}
    >
      <TileContent {...content} />
    </div>
  )
}

/** Accessible description used for the link title and screen readers. */
export function tileLabel(tile: Tile): string {
  const host = hostOf(tile.url)
  return host ? `${tile.title} — ${host}` : tile.title
}
