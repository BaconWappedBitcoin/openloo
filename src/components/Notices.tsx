import { useStore } from '../store/useStore'

/** Transient status messages. Errors are announced assertively. */
export function Notices() {
  const notices = useStore((state) => state.notices)
  const dismiss = useStore((state) => state.dismissNotice)

  if (notices.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
            notice.kind === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-ink)] border border-[var(--color-line)]'
          }`}
        >
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => dismiss(notice.id)}
            aria-label="Dismiss message"
            className="text-lg leading-none opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
