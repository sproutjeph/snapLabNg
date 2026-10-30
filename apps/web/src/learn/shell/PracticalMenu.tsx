import { useEffect, useId, useRef, useState } from "react";
import { IconChevronDown, IconOhm, IconRestart, MarkTick } from "./icons";
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
  /**
   * Watch: plays the demonstration again from its first beat. The menu lists it under the
   * practicals; on a touch screen it is the only place Restart is, because the player's card has
   * no room for it there.
   */
  onRestart?: (() => void) | undefined;
}

export interface PracticalMenuBodyProps {
  stageCount: number;
  /** A tap on a practical's link: the page changes, so the menu closes. */
  onNavigate(): void;
  /** A tap on Restart, after the menu has closed. */
  onRestart?: (() => void) | undefined;
}

/**
 * What the open menu holds: the practicals (the rail's links) with the current one ticked, and
 * under them, set off by a rule, the actions the page offers (Restart in Watch).
 */
export function PracticalMenuBody({ stageCount, onNavigate, onRestart }: PracticalMenuBodyProps) {
  const items = NAV.filter((n) => n.id === "meter" || n.id === "titration" || n.id === "ohms");
  return (
    <>
      <ul>
        {items.map(({ id: itemId, label, Icon, href, current }) => (
          <li key={itemId}>
            <a
              className="sh-pitem"
              href={href}
              aria-current={current ? "page" : undefined}
              onClick={onNavigate}
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
      {onRestart ? (
        <ul className="sh-pmenu-actions">
          <li>
            <button type="button" className="sh-pitem" onClick={onRestart}>
              <span className="sh-pitem-ico" aria-hidden="true">
                <IconRestart />
              </span>
              <span className="sh-pitem-text">
                <b>Restart</b>
                <small>Watch it again from the start</small>
              </span>
            </button>
          </li>
        </ul>
      ) : null}
    </>
  );
}

/**
 * The strip's selector: "PRACTICAL: OHM'S LAW (V–I)" with a caret, opening a menu upward that
 * lists the practicals (the rail's links). Escape or a tap outside closes it and puts focus back
 * on the selector.
 */
export default function PracticalMenu({ title, stageCount, onRestart }: PracticalMenuProps) {
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
          <PracticalMenuBody
            stageCount={stageCount}
            onNavigate={() => setOpen(false)}
            onRestart={
              onRestart
                ? () => {
                    // The menu goes, so focus goes back to the selector rather than to the page.
                    setOpen(false);
                    button.current?.focus();
                    onRestart();
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
