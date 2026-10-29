import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconOhm, MarkTick } from "./icons";
import { NAV } from "./Rail";

/** The practicals the menu lists, and what it says under each name (the stage count is ours). */
const SUBJECT: Readonly<Record<string, string>> = {
  meter: "Physics · Paper 3",
  titration: "Chemistry · Paper 3",
};

export interface PracticalMenuProps {
  /** The practical she is on, as the selector reads it. */
  title: string;
  /** Its number of stages, for the line under its name in the menu. */
  stageCount: number;
}

/**
 * The strip's selector: "PRACTICAL: OHM'S LAW (V–I)" with a caret, opening a menu upward that
 * lists the practicals (the rail's links). Escape or a tap outside closes it and puts focus back
 * on the selector.
 */
export default function PracticalMenu({ title, stageCount }: PracticalMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const items = NAV.filter((n) => n.id === "meter" || n.id === "titration" || n.id === "ohms");

  return (
    <div ref={root} className="sh-practical">
      <button
        ref={button}
        type="button"
        className="sh-practical-btn"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sh-practical-ico" aria-hidden="true">
          <IconOhm />
        </span>
        <span className="sh-practical-label">Practical: {title}</span>
        <span className="sh-practical-caret" aria-hidden="true">
          <IconChevronDown />
        </span>
      </button>
      {open ? (
        <div id={`${id}-menu`} className="sh-pmenu">
          <ul>
            {items.map(({ id: itemId, label, Icon, href, current }) => (
              <li key={itemId}>
                <a
                  className="sh-pitem"
                  href={href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="sh-pitem-ico" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="sh-pitem-text">
                    <b>{label}</b>
                    <small>{current ? `${stageCount} stages` : (SUBJECT[itemId] ?? "")}</small>
                  </span>
                  {current ? (
                    <span className="sh-pitem-tick" aria-hidden="true">
                      <MarkTick />
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
