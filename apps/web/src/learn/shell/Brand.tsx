import type { Ref } from "react";
import { MODE_LABEL } from "../player/stages";
import type { PracticalMode } from "../types";
import { BrandMark } from "./icons";

const MODES: readonly PracticalMode[] = ["watch", "practice", "exam"];

/**
 * The brand, top left: the mark, "SNAPLAB NG", and the three ways through a practical with the
 * one she is in set in ink (heavier as well as darker; the others are muted). On a phone the
 * mark is a button that opens the menu, because there is no rail there (`menu` carries its
 * wiring); on a landscape phone the words fold away and only the mark stays.
 */
export interface BrandProps {
  practical: PracticalMode;
  /** Phone: the mark opens the menu. Without it the mark is plain art. */
  menu?: { open: boolean; controls: string; onToggle(): void };
  /** The menu button, so focus can come back to it. */
  menuRef?: Ref<HTMLButtonElement>;
}

export default function Brand({ practical, menu, menuRef }: BrandProps) {
  const mark = <BrandMark />;
  return (
    <header className="sh-brand" data-region="brand">
      {menu ? (
        <button
          ref={menuRef}
          type="button"
          className="sh-brand-logo sh-menu-btn"
          aria-label={menu.open ? "Close the menu" : "Open the menu"}
          aria-expanded={menu.open}
          aria-controls={menu.controls}
          onClick={menu.onToggle}
        >
          {mark}
        </button>
      ) : (
        <span className="sh-brand-logo">{mark}</span>
      )}
      <div className="sh-brand-text sh-txt">
        <p className="sh-brand-title">SnapLab NG</p>
        <p className="sh-brand-tagline">
          {MODES.map((m, i) => (
            <span key={m}>
              {i > 0 && <i aria-hidden="true">·</i>}
              <span className="sh-mode" aria-current={m === practical ? "true" : undefined}>
                {MODE_LABEL[m]}
              </span>
            </span>
          ))}
        </p>
      </div>
    </header>
  );
}
