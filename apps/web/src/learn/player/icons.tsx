import type { ReactNode } from "react";

// Small ink-line icons for the player: a 24 px grid and round strokes in the current colour.
// They are decorative (aria-hidden) and always sit beside a visible label or inside a button
// with an aria-label.

function Icon({
  children,
  size = 20,
  strokeWidth = 2,
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

export const IconPrev = () => (
  <Icon>
    <path d="M15 5 8 12l7 7" />
  </Icon>
);
export const IconNext = () => (
  <Icon>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);
export const IconPause = () => (
  <Icon>
    <path d="M9 5v14M15 5v14" />
  </Icon>
);
export const IconPlay = () => (
  <Icon>
    <path d="M8 5.5v13l11-6.5z" />
  </Icon>
);
export const IconSpeaker = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </Icon>
);
export const IconSpeakerOff = () => (
  <Icon>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Icon>
);
export const IconSteps = () => (
  <Icon>
    <path d="M9 7h11M9 12h11M9 17h11" />
    <path d="m3.5 7 1 1 2-2M3.5 12l1 1 2-2M3.5 17l1 1 2-2" />
  </Icon>
);
export const IconRepeat = () => (
  <Icon>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5" />
    <path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
  </Icon>
);
export const IconHand = () => (
  <Icon>
    <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4.5a1.5 1.5 0 0 1 2.3-1.8L9 15" />
  </Icon>
);
export const IconTick = () => (
  <Icon size={16} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
