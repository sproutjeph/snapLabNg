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

export const IconQuestion = () => (
  <Icon strokeWidth={1.7}>
    <circle cx="12" cy="12" r="8" />
    <path d="M9.5 9.5a2.8 2.8 0 0 1 5 1.5c0 1.5-2 2-2 3" />
    <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
  </Icon>
);

export const IconSteps = () => (
  <Icon strokeWidth={1.8}>
    <path d="M4 19h4v-4h4v-4h4V7h4" />
  </Icon>
);

export const IconGraph = () => (
  <Icon strokeWidth={1.7}>
    <path d="M4 4v16h16" />
    <path d="m7 14 4-5 4 3 5-7" />
  </Icon>
);

export const IconAnswers = () => (
  <Icon strokeWidth={1.7}>
    <path d="m9 11 3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Icon>
);

export const IconTools = () => (
  <Icon strokeWidth={1.7}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Icon>
);

/** Back to the start: the practical menu's Restart (the player's button has the same mark). */
export const IconRestart = () => (
  <Icon strokeWidth={1.8}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
);

/** Two dry cells in a holder: two short/long plate pairs in a box. */
export const IconCells = () => (
  <Icon>
    <path d="M3 8h18v9H3z" />
    <path d="M8 5v14M16 5v14" />
    <path d="M6.5 10v5M11 10v5M14.5 10v5M19 10v5" />
  </Icon>
);

/** A plug key: two terminal posts with a plug bar across the gap. */
export const IconKey = () => (
  <Icon>
    <path d="M4 17h4M16 17h4" />
    <circle cx="9.5" cy="17" r="1.4" />
    <circle cx="14.5" cy="17" r="1.4" />
    <path d="M9.5 15.5 13 8h3l-1.5 7" />
  </Icon>
);

/** An ammeter: a dial with the letter A and a needle. */
export const IconAmmeter = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 16 3.5-7 3.5 7M9.8 13.5h4.4" />
    <path d="M12 12 15 6.5" />
  </Icon>
);

/** A voltmeter: a dial with the letter V and a needle. */
export const IconVoltmeter = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 9 3.5 7 3.5-7" />
    <path d="M12 12 15 6.5" />
  </Icon>
);

/** A plug-type resistance box: a case, plugs on top and a coil zig-zag inside. */
export const IconResistanceBox = () => (
  <Icon>
    <path d="M3.5 10h17v9h-17z" />
    <path d="M7 10V6.5M12 10V6.5M17 10V6.5" />
    <circle cx="7" cy="5.5" r="1" />
    <circle cx="12" cy="5.5" r="1" />
    <circle cx="17" cy="5.5" r="1" />
    <path d="M5.5 14.5h2l1-2 2 4 2-4 2 4 1-2h3" />
  </Icon>
);

/** The resistance wire XY on its board, with the metre rule under it. */
export const IconWire = () => (
  <Icon>
    <path d="M3 9h18" />
    <path d="M5 9v3M19 9v3" />
    <path d="M5 6.5 3.5 4M19 6.5 20.5 4" />
    <path d="M3 16h18M5 16v2M9 16v2M13 16v2M17 16v2M21 16v2" />
  </Icon>
);

/** Connecting leads: a curved lead with a croc clip at each end. */
export const IconLeads = () => (
  <Icon>
    <path d="M6 5c8 10 10 4 12 12" />
    <path d="M4 3.5 7 6l-1.5 2L3 5.5zM21 18.5 18 16l1.5-2 2.5 2.5z" />
    <circle cx="6" cy="6" r="1" />
    <circle cx="18" cy="18" r="1" />
  </Icon>
);

/** A metre rule: a long rule with cm ticks. */
export const IconRule = () => (
  <Icon>
    <path d="M3 9h18v6H3z" />
    <path d="M6 9v3M9 9v4M12 9v3M15 9v4M18 9v3" />
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
