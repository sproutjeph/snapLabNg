import { type ComponentType, useEffect, useId, useRef, useState } from "react";
import {
  IconAbout,
  IconChevronRight,
  IconHome,
  IconMetreBridge,
  IconNotebook,
  IconOhm,
  IconTitration,
} from "./icons";

export interface NavItem {
  id: string;
  label: string;
  Icon: ComponentType;
  href?: string;
  current?: boolean;
}

/** The page's six places. The strip's practical menu lists the three practicals from here. */
export const NAV: NavItem[] = [
  { id: "home", label: "Home", Icon: IconHome, href: "/" },
  { id: "meter", label: "Metre bridge", Icon: IconMetreBridge, href: "/?flow=1&golden=note1" },
  { id: "titration", label: "Titration", Icon: IconTitration, href: "/?kit=titration" },
  {
    id: "ohms",
    label: "Ohm's law (V–I)",
    Icon: IconOhm,
    href: "/?learn=ohms-law",
    current: true,
  },
  { id: "notebook", label: "Notebook", Icon: IconNotebook },
  { id: "about", label: "About", Icon: IconAbout, href: "/?about=1" },
];

/**
 * The page's links as a list. In the rail each item is an icon with its label to the right (the
 * label is clipped away while the rail is closed, never `display: none`, so a screen reader
 * still has it); in the phone menu each is a full-width row. The Notebook item is a button.
 */
export function NavList({
  variant,
  onNotebook,
  onNavigate,
}: {
  variant: "rail" | "menu";
  onNotebook(): void;
  onNavigate?(): void;
}) {
  return (
    <ul className={`sh-nav sh-nav-${variant}`}>
      {NAV.map(({ id, label, Icon, href, current }) => (
        <li key={id} className="sh-nav-li">
          {href ? (
            <a
              className="sh-nav-item"
              href={href}
              aria-current={current ? "page" : undefined}
              aria-label={label}
              onClick={onNavigate}
            >
              <Icon />
              <span className="sh-nav-label sh-txt">{label}</span>
            </a>
          ) : (
            <button
              type="button"
              className="sh-nav-item"
              aria-label={label}
              onClick={() => {
                onNavigate?.();
                onNotebook();
              }}
            >
              <Icon />
              <span className="sh-nav-label sh-txt">{label}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The dark rail down the left of a laptop: an icon nav that opens to a 248 px overlay with
 * labels. Escape or a tap on the stage closes it and puts focus back on the toggle.
 */
export default function Rail({ onNotebook }: { onNotebook(): void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
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
    <nav
      ref={root}
      id={id}
      className="sh-rail"
      data-region="rail"
      data-open={open}
      aria-label="SnapLab NG"
    >
      <button
        ref={toggle}
        type="button"
        className="sh-rail-toggle"
        aria-label={open ? "Close the menu" : "Open the menu"}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((o) => !o)}
      >
        <IconChevronRight />
      </button>
      <div id={`${id}-list`} className="sh-rail-nav">
        <NavList variant="rail" onNotebook={onNotebook} onNavigate={() => setOpen(false)} />
      </div>
    </nav>
  );
}
