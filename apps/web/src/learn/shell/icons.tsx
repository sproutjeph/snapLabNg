import type { ReactNode } from "react";

// Simple line icons drawn for the shell: 24 × 24 grid, 1.6 px strokes, no fill. They inherit the
// text colour, are decorative (aria-hidden) and always sit beside a visible label or an
// aria-labelled button.

function Icon({
  children,
  size = 24,
  strokeWidth = 1.6,
}: {
  children: ReactNode;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconHome = () => (
  <Icon>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10.5V19h12v-8.5" />
    <path d="M10 19v-5h4v5" />
  </Icon>
);

/** A bridge wire with a jockey touching it. */
export const IconMetreBridge = () => (
  <Icon>
    <path d="M3 16h18" />
    <path d="M3 13v6M21 13v6" />
    <path d="M12 4v7" />
    <path d="m9.5 11 2.5 4 2.5-4z" />
  </Icon>
);

/** A burette over a flask. */
export const IconTitration = () => (
  <Icon>
    <path d="M10 3h4v8l-2 2-2-2z" />
    <path d="M12 13v2" />
    <path d="M10.5 15h3l3.5 5.5H7z" />
  </Icon>
);

/** A resistor zig-zag between two leads. */
export const IconOhm = () => (
  <Icon>
    <path d="M2.5 12H6l1.5-5 3 10 3-10 3 10 1.5-5h3.5" />
  </Icon>
);

export const IconNotebook = () => (
  <Icon>
    <path d="M6 4h12v16H6z" />
    <path d="M9 4v16" />
    <path d="M12 9h3.5M12 12.5h3.5" />
  </Icon>
);

export const IconAbout = () => (
  <Icon>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </Icon>
);

export const IconMenu = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconClose = () => (
  <Icon>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

/** Two small circuits side by side: the "compare with diagram" mark. */
export const IconDiagram = () => (
  <Icon>
    <path d="M4 7h7v10H4z" />
    <path d="M14 7h6M14 12h6M14 17h6" strokeDasharray="2 2" />
  </Icon>
);

/** An open book: the practical's mark on the status card. */
export const IconBook = () => (
  <Icon strokeWidth={1.5}>
    <path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5c-3.5-.4-6.5 0-8.5 1.5z" />
    <path d="M12 6.5v13" />
  </Icon>
);

/** A page with a folded corner: the mark in front of the paper's source (the credit). */
export const IconPage = () => (
  <Icon strokeWidth={1.7}>
    <path d="M7 3.5h7.5L18 7v13.5H7z" />
    <path d="M14.5 3.5V7H18" />
    <path d="M9.5 11.5h6M9.5 14.5h6M9.5 17.5h4" />
  </Icon>
);

/** Back to the start: the practical menu's Restart (the player's button has the same mark). */
export const IconRestart = () => (
  <Icon strokeWidth={1.8}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
);

export const IconChevronRight = () => (
  <Icon strokeWidth={2}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const IconChevronLeft = () => (
  <Icon strokeWidth={2}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const IconChevronUp = () => (
  <Icon strokeWidth={2}>
    <path d="m5 15 7-7 7 7" />
  </Icon>
);

export const IconChevronDown = () => (
  <Icon strokeWidth={2}>
    <path d="m5 9 7 7 7-7" />
  </Icon>
);

export const IconLock = () => (
  <Icon strokeWidth={1.8}>
    <path d="M6.5 11h11v8.5h-11z" />
    <path d="M9 11V8.5a3 3 0 0 1 6 0V11" />
  </Icon>
);

/**
 * The SnapLab NG mark: a lens ring with a resistor's zig-zag through it and a small ink dot, in
 * ink and the accent. Drawn for the brand; it takes its size from the box it sits in.
 */
export const BrandMark = () => (
  <svg
    viewBox="0 0 82 84"
    width="100%"
    height="100%"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="41" cy="42" r="34" stroke="currentColor" strokeWidth="4.5" />
    <circle cx="41" cy="42" r="26" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
    <path
      d="M12 42h13l5-14 9 28 9-28 9 28 5-14h8"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="66" cy="16" r="5.5" fill="var(--accent)" />
  </svg>
);

/** Tick used on a step that is done. Heavier stroke, drawn inside a filled disc. */
export const MarkTick = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m1.8 5.3 2.2 2.2 4.2-4.8" />
  </svg>
);

/** Cross used on a step that was lost. */
export const MarkCross = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m2.2 2.2 5.6 5.6M7.8 2.2 2.2 7.8" />
  </svg>
);
