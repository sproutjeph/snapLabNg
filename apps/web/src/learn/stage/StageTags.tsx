import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Covered } from "../../scene/look/types";
import type { CalloutSpec } from "../callouts/types";
import { MAX_TAGS, type StageMotion } from "./stageMotion";
import "./stageTags.css";

// The guided identify beats' part tags (Beat.tags; docs/plans/guided-demo.md): a ringed dot on the
// part and a paper card beside it with the part's name and its one plain line. Choreo projects each
// part to canvas px every frame (the camera is easing between parts) and calls `onFrame`, which
// moves the DOM directly. React renders again only when the beat's tags change.

/** The gap between the dot and its card, and the card's distance from the edge of the free area. */
const GAP_PX = 16;
/** A lone tag stands a little further off, so its card keeps off the part it names. */
const GAP_LONE_PX = 36;
const EDGE_PX = 10;
const TOP_EXTRA_PX = 24;

interface Size {
  w: number;
  h: number;
}

/** The cards placed so far this frame (a tag takes the first spot clear of those before it). */
const PLACED_X = new Float64Array(MAX_TAGS);
const PLACED_Y = new Float64Array(MAX_TAGS);
const PLACED_W = new Float64Array(MAX_TAGS);
const PLACED_H = new Float64Array(MAX_TAGS);

interface FreeArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a card may stand from its dot, in the order tried: right of it, left of it, then centred
 * above or below, each nearer first, then one card further out, up to three.
 */
const TRIES: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  for (let further = 0; further <= 3; further++) {
    for (const [sx, sy] of [
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
    ] as const) {
      if (further > 0 && sy === 0) continue;
      out.push([sx, sy, further]);
    }
  }
  return out;
})();

/**
 * Puts card `i` (w by h) beside the dot at (x, y), inside `a`, clear of the cards before it: the
 * first try that fits wins; a lone tag, or one that fits nowhere, takes the first try, clamped.
 * Writes PLACED_*[i]. Allocates nothing.
 */
function place(
  i: number,
  x: number,
  y: number,
  w: number,
  h: number,
  a: FreeArea,
  gap: number,
): void {
  let bestX = 0;
  let bestY = 0;
  let found = false;
  for (let t = 0; t < TRIES.length && !found; t++) {
    const [sx, sy, further] = TRIES[t] ?? TRIES[0] ?? [1, -1, 0];
    let left = sx > 0 ? x + gap : sx < 0 ? x - gap - w : x - w / 2;
    let top = sy < 0 ? y - gap - h : sy > 0 ? y + gap : y - h / 2;
    if (further) top += sy * further * (h + 6);
    left = Math.max(a.left, Math.min(left, a.right - w));
    top = Math.max(a.top, Math.min(top, a.bottom - h));
    let clear = true;
    for (let j = 0; j < i && clear; j++) {
      clear =
        left >= (PLACED_X[j] ?? 0) + (PLACED_W[j] ?? 0) + 4 ||
        left + w + 4 <= (PLACED_X[j] ?? 0) ||
        top >= (PLACED_Y[j] ?? 0) + (PLACED_H[j] ?? 0) + 4 ||
        top + h + 4 <= (PLACED_Y[j] ?? 0);
    }
    if (t === 0) {
      bestX = left;
      bestY = top;
    }
    if (clear) {
      bestX = left;
      bestY = top;
      found = true;
    }
  }
  PLACED_X[i] = bestX;
  PLACED_Y[i] = bestY;
  PLACED_W[i] = w;
  PLACED_H[i] = h;
}

export function StageTags({
  motion,
  layer,
  covered,
}: {
  motion: StageMotion;
  /** The shell's callout layer (over the canvas, under the cards). */
  layer: RefObject<HTMLDivElement | null>;
  /** What the page's cards cover, for a window this size (the stage's own `covered`). */
  covered: (width: number, height: number) => Covered;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [specs, setSpecs] = useState<readonly CalloutSpec[]>(motion.tags.specs);
  const wraps = useRef<Array<HTMLDivElement | null>>([]);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const leaders = useRef<Array<HTMLSpanElement | null>>([]);
  const sizes = useRef<Size[]>(Array.from({ length: MAX_TAGS }, () => ({ w: 200, h: 60 })));
  const area = useRef({ left: 0, top: 0, right: 1000, bottom: 600 });
  const coveredRef = useRef(covered);
  coveredRef.current = covered;

  useEffect(() => setHost(layer.current), [layer]);

  // The free area of the stage: what the cards leave, in the layer's own px.
  useEffect(() => {
    if (!host) return;
    const measure = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      const c = coveredRef.current(window.innerWidth, window.innerHeight);
      area.current = {
        left: c.left + EDGE_PX,
        // The player's pill hangs a little below the top bar's covered edge.
        top: c.top + EDGE_PX + TOP_EXTRA_PX,
        right: w - c.right - EDGE_PX,
        bottom: h - c.bottom - EDGE_PX,
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host]);

  // New words: render them, then measure each card.
  useEffect(() => {
    motion.tags.onSpecs = () => setSpecs(motion.tags.specs);
    return () => {
      motion.tags.onSpecs = null;
    };
  }, [motion]);

  // Each card's size, kept current as it renders, loads its font or wraps (no layout reads per frame).
  // biome-ignore lint/correctness/useExhaustiveDependencies: new specs or a new host mean new cards to watch.
  useLayoutEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const i = cards.current.indexOf(e.target as HTMLDivElement);
        const size = sizes.current[i];
        if (size) {
          const el = e.target as HTMLElement;
          size.w = el.offsetWidth;
          size.h = el.offsetHeight;
        }
      }
    });
    for (let i = 0; i < specs.length; i++) {
      const el = cards.current[i];
      const size = sizes.current[i];
      if (el && size) {
        size.w = el.offsetWidth;
        size.h = el.offsetHeight;
        ro.observe(el);
      }
    }
    return () => ro.disconnect();
  }, [specs, host]);

  // Each frame: put the dot on the part and the card beside it, inside the free area.
  useEffect(() => {
    motion.tags.onFrame = () => {
      const { points } = motion.tags;
      const a = area.current;
      for (let i = 0; i < MAX_TAGS; i++) {
        const wrap = wraps.current[i];
        if (!wrap) continue;
        const pt = points[i];
        if (!pt?.visible || i >= motion.tags.specs.length) {
          if (wrap.dataset.on !== "0") wrap.dataset.on = "0";
          continue;
        }
        if (wrap.dataset.on !== "1") wrap.dataset.on = "1";
        wrap.style.transform = `translate3d(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px, 0)`;
        const card = cards.current[i];
        const size = sizes.current[i];
        if (!card || !size) continue;
        place(
          i,
          pt.x,
          pt.y,
          size.w,
          size.h,
          a,
          motion.tags.specs.length === 1 ? GAP_LONE_PX : GAP_PX,
        );
        const left = PLACED_X[i] ?? 0;
        const top = PLACED_Y[i] ?? 0;
        // A thin line from the dot to the nearest edge of its card.
        const leader = leaders.current[i];
        if (leader) {
          const nx = Math.max(left, Math.min(pt.x, left + size.w)) - pt.x;
          const ny = Math.max(top, Math.min(pt.y, top + size.h)) - pt.y;
          leader.style.width = `${Math.hypot(nx, ny).toFixed(1)}px`;
          leader.style.transform = `rotate(${Math.atan2(ny, nx).toFixed(3)}rad)`;
        }
        card.style.transform = `translate3d(${(left - pt.x).toFixed(1)}px, ${(top - pt.y).toFixed(1)}px, 0)`;
      }
    };
    return () => {
      motion.tags.onFrame = null;
    };
  }, [motion]);

  if (!host) return null;
  return createPortal(
    <div className="gt-layer" data-testid={specs.length > 0 ? "part-tags" : undefined}>
      {specs.map((spec, i) => (
        <div
          // The tags are replaced as a set each beat: a new beat's tag pops in again.
          key={`${spec.anchor}:${spec.label}:${specs.length}`}
          ref={(el) => {
            wraps.current[i] = el;
          }}
          className="gt-tag"
          data-on="0"
          data-lone={specs.length === 1 ? "1" : undefined}
        >
          <span
            ref={(el) => {
              leaders.current[i] = el;
            }}
            className="gt-leader"
            aria-hidden="true"
          />
          <span className="gt-dot" aria-hidden="true" />
          <div
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="gt-card"
          >
            <span className="gt-name">{spec.label}</span>
            {spec.sub ? <span className="gt-line">{spec.sub}</span> : null}
          </div>
        </div>
      ))}
    </div>,
    host,
  );
}
