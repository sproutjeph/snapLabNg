import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { IconClose } from "./icons";

interface SheetProps {
  /** Accessible name and visible heading. */
  label: string;
  closeLabel: string;
  onClose(): void;
  /** Where focus goes on close if the element that opened the sheet has unmounted (the phone menu). */
  fallbackFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal sheet: a centred card on a laptop, a bottom sheet on a phone. Escape or a tap on the
 * paper outside closes it; Tab stays inside; focus returns to where it was. The key handler sits
 * on `document`, so Escape and the Tab trap still work after a click on plain text.
 */
export default function Sheet({ label, closeLabel, onClose, fallbackFocus, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      const root = ref.current;
      if (e.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!root.contains(active) || active === root) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // An opener that unmounted (the phone menu item) leaves focus on <body>.
      if (before && before !== document.body && before.isConnected) before.focus();
      else fallbackRef.current?.current?.focus();
    };
  }, []);

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
        tabIndex={-1}
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
