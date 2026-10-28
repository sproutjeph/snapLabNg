import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { IconClose } from "./icons";

interface SheetProps {
  /** Accessible name and visible heading. */
  label: string;
  closeLabel: string;
  onClose(): void;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal sheet: a centred card on a laptop, a bottom sheet on a phone. Escape or a tap on the
 * paper outside closes it; Tab stays inside; focus returns to where it was.
 */
export default function Sheet({ label, closeLabel, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => before?.focus?.();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="sh-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="sh-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <div className="sh-card-head">
          <h2 className="sh-label">{label}</h2>
          <button
            type="button"
            className="sh-icon-btn"
            aria-label={closeLabel}
            onClick={onClose}
            data-autofocus
          >
            <IconClose />
          </button>
        </div>
        <div className="sh-sheet-body">{children}</div>
      </div>
    </div>
  );
}
