import { type RefObject, useLayoutEffect, useSyncExternalStore } from "react";
import {
  COMPACT_CREDIT_MIN_LW,
  type LayoutInfo,
  type LayoutMode,
  layoutFor,
  SHORT_BRAND_MIN_STAGE,
} from "./layout";

// Applies shell/layout.ts to a root element. `--ui`, `--lw`, `--lh`, `--label` (and
// `--scene-bottom`, `--guide-w`) and `data-layout` are written onto the element straight from the
// resize handler, a frame at a time, so a drag of the window never re-renders React. React hears
// about it only when the *mode* changes (useSyncExternalStore on the mode string), because the
// markup differs per mode (no rail on a phone, a sheet for the diagram, and so on).

/** The size the layout is computed from: the window, which a fixed full-screen root equals. */
function viewportLayout(): LayoutInfo {
  return layoutFor(window.innerWidth, window.innerHeight);
}

/** The callout labels' scale: the page's scale on a laptop, never below 0.62 on a phone. */
function labelScale(l: LayoutInfo): number {
  return l.mode === "portrait" ? 0.62 : l.ui;
}

/** Writes a layout's variables and data attributes on `el`. */
export function applyLayout(el: HTMLElement, l: LayoutInfo): void {
  const s = el.style;
  s.setProperty("--ui", String(l.ui));
  s.setProperty("--lw", `${l.lw}px`);
  s.setProperty("--lh", `${l.lh}px`);
  s.setProperty("--label", String(labelScale(l)));
  if (l.sceneBottom === undefined) s.removeProperty("--scene-bottom");
  else s.setProperty("--scene-bottom", `${l.sceneBottom}px`);
  if (l.guideW === undefined) s.removeProperty("--guide-w");
  else s.setProperty("--guide-w", `${l.guideW}px`);
  el.dataset.layout = l.mode;
  // A compact screen folds the status card's credit to its mark; a narrow landscape phone folds
  // the brand to its mark.
  if (l.mode === "compact" && l.lw < COMPACT_CREDIT_MIN_LW) el.dataset.credit = "mark";
  else delete el.dataset.credit;
  if (l.mode === "short" && l.lw - (l.guideW ?? 0) < SHORT_BRAND_MIN_STAGE) {
    el.dataset.brand = "badge";
  } else delete el.dataset.brand;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const modeNow = (): LayoutMode => viewportLayout().mode;
const modeOnServer = (): LayoutMode => "wide";

/** The layout mode now; it re-renders only when the mode changes. */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, modeNow, modeOnServer);
}

/**
 * Keeps `ref`'s element in step with the window: variables before the first paint, then on
 * every resize (at most once a frame). Returns the mode.
 */
export function useLayout(ref: RefObject<HTMLElement | null>): LayoutMode {
  const mode = useLayoutMode();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => applyLayout(el, viewportLayout());
    update();
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [ref]);
  return mode;
}

/**
 * Slides an accent mark (a tab's underline, the strip's cursor) under whichever child of `box`
 * matches `selector`: it writes the child's offset and size onto `ink` as a transform and a
 * width, before paint and again whenever the box is resized, so React never re-renders for it.
 * With no match the mark fades out. The slide itself is a CSS transition (off under reduced
 * motion), so the first placement does not animate.
 */
export function useSlider(
  box: RefObject<HTMLElement | null>,
  ink: RefObject<HTMLElement | null>,
  selector: string,
  /** Changes whenever the active child, or what it sits among, may have moved. */
  key: string,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is what tells the mark to move.
  useLayoutEffect(() => {
    const host = box.current;
    const mark = ink.current;
    if (!host || !mark) return;
    const place = () => {
      const on = host.querySelector<HTMLElement>(selector);
      if (!on) {
        mark.style.opacity = "0";
        return;
      }
      mark.style.opacity = "1";
      mark.style.width = `${on.offsetWidth}px`;
      mark.style.transform = `translateX(${on.offsetLeft}px)`;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(host);
    return () => observer.disconnect();
  }, [box, ink, selector, key]);
}
