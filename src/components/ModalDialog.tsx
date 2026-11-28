import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

function isBackdrop(dialog: HTMLDialogElement, target: EventTarget | null, x: number, y: number) {
  if (target !== dialog) return false;
  const { top, right, bottom, left } = dialog.getBoundingClientRect();
  return x < left || x > right || y < top || y > bottom;
}

export function ModalDialog({ open, title, subtitle, onClose, children }: ModalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      pressedBackdrop.current = false;
      dialog.close();
    }
  }, [open]);

  const supportsClosedBy =
    typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

  return (
    <dialog
      ref={ref}
      className="metric-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={(event) => {
        if (event.target === event.currentTarget && open && !event.currentTarget.open) onClose();
      }}
      onPointerDown={(event) => {
        if (supportsClosedBy) return;
        pressedBackdrop.current = isBackdrop(event.currentTarget, event.target, event.clientX, event.clientY);
      }}
      onPointerCancel={() => { pressedBackdrop.current = false; }}
      onClick={(event) => {
        if (supportsClosedBy) return;
        if (pressedBackdrop.current && isBackdrop(event.currentTarget, event.target, event.clientX, event.clientY)) {
          onClose();
        }
        pressedBackdrop.current = false;
      }}
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-5 py-3.5"
        style={{
          borderColor: 'var(--line-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-base font-semibold">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--ink-muted)' }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors"
          style={{
            borderColor: 'var(--line-subtle)',
            background: 'var(--bg-subtle)',
            color: 'var(--ink-primary)',
          }}
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
