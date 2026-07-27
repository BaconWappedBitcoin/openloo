import { ICON_SET } from '../lib/icons'
import { inputClass } from './Modal'

interface IconPickerProps {
  /** Currently selected emoji, if the tile is using one. */
  selected: string | null
  onPick(char: string): void
}

/**
 * A grid of ready-made icons to choose from, grouped by theme, with a free-form
 * field for any emoji the set does not include.
 */
export function IconPicker({ selected, onPick }: IconPickerProps) {
  return (
    <div className="mt-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
      <div className="max-h-52 overflow-y-auto pr-1">
        {ICON_SET.map((group) => (
          <div key={group.label} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-xs font-medium text-[var(--color-ink-muted)]">
              {group.label}
            </div>
            <div className="grid grid-cols-8 gap-1">
              {group.icons.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => onPick(char)}
                  aria-label={`Use icon ${char}`}
                  aria-pressed={selected === char}
                  className={`flex aspect-square items-center justify-center rounded-md text-xl transition hover:bg-[var(--color-line)] ${
                    selected === char ? 'bg-blue-500/15 ring-2 ring-blue-500' : ''
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="mt-2 block border-t border-[var(--color-line)] pt-2">
        <span className="mb-1 block text-xs text-[var(--color-ink-muted)]">
          …or paste any emoji
        </span>
        <input
          className={inputClass}
          value={selected ?? ''}
          onChange={(event) => onPick(event.target.value.slice(0, 8))}
          placeholder="e.g. 🚀"
          aria-label="Custom emoji"
        />
      </label>
    </div>
  )
}
