import type { ReactNode } from "react";
import type { ActorAction } from "../script/types";

// Small ink-line icons for the player and the stage checklist: a 24 px grid and round strokes in
// the current colour. They are decorative (aria-hidden) and always sit beside a visible label or
// inside a button with an aria-label.

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

/** Back to the start of the demonstration. */
export const IconRestart = () => (
  <Icon>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5" />
    <path d="M4.5 4.5v4h4" />
  </Icon>
);
/** The previous beat: a bar and a triangle pointing back. */
export const IconSkipBack = () => (
  <Icon>
    <path d="M6 5v14" />
    <path d="M18 5.5v13L9 12z" />
  </Icon>
);
/** The next beat. */
export const IconSkipNext = () => (
  <Icon>
    <path d="M18 5v14" />
    <path d="M6 5.5v13l9-6.5z" />
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
export const IconChevron = () => (
  <Icon size={22} strokeWidth={2}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

/**
 * What a checklist row is about, drawn in ink in its ring: the action the beat has (parts coming
 * onto the bench, a lead, a plug, the key, a close look, writing, a point, a line, a triangle).
 * A beat with no action, or a wait, gets a dot.
 */
export function ActGlyph({ kind }: { kind: ActorAction["kind"] | undefined }) {
  const body = (() => {
    switch (kind) {
      case "enter":
        return (
          <>
            <path d="M12 3.5 19.5 7.5v9L12 20.5 4.5 16.5v-9z" />
            <path d="M4.5 7.5 12 11.5l7.5-4M12 11.5v9" />
          </>
        );
      case "lead":
        return (
          <>
            <circle cx="5.5" cy="17.5" r="2" />
            <circle cx="18.5" cy="6.5" r="2" />
            <path d="M7.3 16.3C11.5 14.5 8.5 9.5 16.7 7.7" />
          </>
        );
      case "plug":
        return (
          <>
            <circle cx="12" cy="13.5" r="5.5" />
            <path d="M9 4.5v3.5M15 4.5v3.5" />
          </>
        );
      case "key":
        return (
          <>
            <path d="M3.5 16h5M15.5 16h5" />
            <circle cx="9.5" cy="16" r="1.2" />
            <circle cx="14.5" cy="16" r="1.2" />
            <path d="M9.5 16 15.5 8.5" />
          </>
        );
      case "loupe":
        return (
          <>
            <circle cx="10.5" cy="10.5" r="5.5" />
            <path d="m15 15 5 5" />
          </>
        );
      case "write":
        return (
          <>
            <path d="m4.5 19.5 1-4.2L15.8 5a1.8 1.8 0 0 1 2.5 0l.7.7a1.8 1.8 0 0 1 0 2.5L8.7 18.5z" />
            <path d="m14 7 3 3" />
          </>
        );
      case "plot":
        return (
          <>
            <path d="M5 4v15h15" />
            <circle cx="11.5" cy="11.5" r="1.7" fill="currentColor" />
          </>
        );
      case "line":
        return (
          <>
            <path d="M5 4v15h15" />
            <path d="M7.5 16.5 18 7" />
          </>
        );
      case "triangle":
        return (
          <>
            <path d="M5 4v15h15" />
            <path d="M8.5 16.5 17.5 8.5v8z" />
          </>
        );
      default:
        return <circle cx="12" cy="12" r="2.4" fill="currentColor" />;
    }
  })();
  return (
    <svg
      className="sc-glyph"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
