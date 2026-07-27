import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface BoardMetrics {
  /** Side length of one grid cell, in pixels. */
  cell: number
  boardWidth: number
  boardHeight: number
  /** False until a real measurement has landed, so the board can stay hidden. */
  ready: boolean
}

/** Below this a tile is too small to read; the board scrolls instead. */
const MIN_CELL = 28

/**
 * Size the board to fit its container.
 *
 * Cells are square and fitted against both axes, so a wide grid in a short
 * window shrinks rather than overflowing. This is measured rather than
 * expressed in CSS because the drag layer needs the pixel pitch of a cell to
 * turn a pointer delta into grid coordinates.
 *
 * Measurement is deliberately defensive: a `ResizeObserver` can deliver a
 * transient zero or near-zero box during mount or in a tab that is not
 * compositing. Committing to such a value would leave the board permanently
 * mis-sized, because a container that then stays the same size never fires the
 * observer again. Degenerate boxes are therefore ignored, and a re-measure is
 * scheduled on the next frame and whenever the tab becomes visible.
 */
export function useBoardMetrics(
  cols: number,
  rows: number,
  gap: number,
  maxCell = 120,
): [React.RefObject<HTMLDivElement | null>, BoardMetrics] {
  const ref = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(0)

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return

    // The content box, not the border box: `clientWidth` already excludes the
    // scrollbar and border, and the padding is subtracted here. Fitting to the
    // border box would overshoot by the padding and make the board overflow the
    // very container it is supposed to fit inside.
    const style = getComputedStyle(element)
    const width =
      element.clientWidth - (parseFloat(style.paddingLeft) + parseFloat(style.paddingRight))
    const height =
      element.clientHeight - (parseFloat(style.paddingTop) + parseFloat(style.paddingBottom))

    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return

    const byWidth = (width - gap * (cols - 1)) / cols
    const byHeight = (height - gap * (rows - 1)) / rows
    const fitted = Math.floor(Math.min(byWidth, byHeight))
    setCell(Math.max(MIN_CELL, Math.min(maxCell, fitted)))
  }, [cols, rows, gap, maxCell])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    measure()
    // Re-measure once layout has settled, in case the first pass ran before
    // the element had been laid out.
    const frame = requestAnimationFrame(measure)

    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measure])

  // A tab restored from the background can report a stale box.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) measure()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [measure])

  return [
    ref,
    {
      cell,
      boardWidth: cell * cols + gap * (cols - 1),
      boardHeight: cell * rows + gap * (rows - 1),
      ready: cell > 0,
    },
  ]
}
