import type { ReactNode } from "react";

// Simple line icons drawn for the shell: 24 × 24 grid, 1.6 px strokes, no fill. They inherit the
// text colour, are decorative (aria-hidden) and always sit beside a visible label or an
// aria-labelled button.

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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
