import type { ReactNode } from "react";

// The three picker illustrations: hand-inked, near-isometric (45° corner view, parallel edges), in
// the lab's own palette (mahogany, pine, bakelite, brass, cream paper; blue-black ink outlines).
// Procedural SVG, no images, painted once and static; home.css pops each drawing in.
// Decorative: each card carries its own title, so these are aria-hidden.

const INK = "#1d2430";
const LEAD = "#2d3a55";
const MAHOGANY = ["#8a4d33", "#6b3a26", "#4e2a1b"] as const; // top, lit side, shaded side
const PINE = ["#ecd2a0", "#d9b982", "#bf9c63"] as const;
const BAKELITE = ["#3d3b3b", "#2b2a2a", "#1c1b1b"] as const;
const BRASS = ["#e0b865", "#c79a45", "#9d762f"] as const;
const CREAM = "#f6efdd";
const SHADOW = "#5b4027";

type Rgb3 = readonly [string, string, string];
type P2 = readonly [number, number];

/** Near-isometric projection: x runs right and down, y runs left and down, z runs up. */
function projector(ox: number, oy: number) {
  const c = 0.866;
  return (x: number, y: number, z: number): P2 => [ox + (x - y) * c, oy + (x + y) * 0.5 - z];
}
type Iso = ReturnType<typeof projector>;

const path = (pts: readonly P2[]) =>
  `${pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")}Z`;

/** A filled face with its ink outline. */
function Face({ d, fill, w = 1.6 }: { d: string; fill: string; w?: number }) {
  return (
    <>
      <path d={d} fill={fill} />
      <path d={d} fill="none" stroke={INK} strokeWidth={w} strokeLinejoin="round" />
    </>
  );
}

/** A line of ink. */
function Ink({ d, w = 1.4, c = INK }: { d: string; w?: number; c?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

interface BoxSpec {
  iso: Iso;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  colours: Rgb3;
}

/** A box: its top and its two visible sides. */
function Box({ iso, x, y, z, w, d, h, colours }: BoxSpec) {
  const top = path([
    iso(x, y, z + h),
    iso(x + w, y, z + h),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  ]);
  const left = path([
    iso(x, y + d, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x, y + d, z + h),
  ]);
  const right = path([
    iso(x + w, y, z),
    iso(x + w, y + d, z),
    iso(x + w, y + d, z + h),
    iso(x + w, y, z + h),
  ]);
  return (
    <g>
      <Face d={left} fill={colours[1]} />
      <Face d={right} fill={colours[2]} />
      <Face d={top} fill={colours[0]} />
    </g>
  );
}

/**
 * The warm contact shadow under the parts: each footprint [x, y, width, depth] on the desk,
 * grown a little and rounded at its corners. One flat tone for the lot, so overlaps do not
 * darken. Not a blur.
 */
function Shadows({
  iso,
  feet,
}: {
  iso: Iso;
  feet: ReadonlyArray<readonly [number, number, number, number]>;
}) {
  const grow = 5;
  return (
    <g opacity={0.2}>
      {feet.map(([x, y, w, d]) => (
        <path
          key={`${x},${y}`}
          d={path([
            iso(x - grow, y - grow, 0),
            iso(x + w + grow, y - grow, 0),
            iso(x + w + grow, y + d + grow, 0),
            iso(x - grow, y + d + grow, 0),
          ])}
          fill={SHADOW}
          stroke={SHADOW}
          strokeWidth={8}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

/** A terminal post: a brass cap on a short stem. */
function Terminal({ at }: { at: P2 }) {
  const [x, y] = at;
  return (
    <g>
      <rect
        x={x - 1.6}
        y={y - 3}
        width={3.2}
        height={4}
        fill={BRASS[1]}
        stroke={INK}
        strokeWidth={1}
      />
      <ellipse
        cx={x}
        cy={y - 3.4}
        rx={3.6}
        ry={2.1}
        fill={BRASS[0]}
        stroke={INK}
        strokeWidth={1.1}
      />
    </g>
  );
}

/** A lead with a crocodile clip at each end: a sagging curve of blue-black wire. */
function Lead({ a, b, sag = 14 }: { a: P2; b: P2; sag?: number }) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2 + sag;
  const d = `M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}`;
  const clip = ([x, y]: P2, k: number) => (
    <path
      key={k}
      d={`M${x - 3} ${y - 2} L${x + 4} ${y - 4} L${x + 5} ${y + 1} L${x - 2} ${y + 3}Z`}
      fill={BRASS[0]}
      stroke={INK}
      strokeWidth={1}
      strokeLinejoin="round"
    />
  );
  return (
    <g>
      <Ink d={d} w={2.2} c={LEAD} />
      {clip(a, 0)}
      {clip(b, 1)}
    </g>
  );
}

/** The drawing's frame: decorative, and the same 320 × 230 box for every card. */
function Art({ children, label, view }: { children: ReactNode; label: string; view: string }) {
  return (
    <svg className="pk-art" viewBox={view} aria-hidden="true" focusable="false" data-art={label}>
      {children}
    </svg>
  );
}

/** A round glass-faced dial on the left face of a meter case, drawn in that face's plane. */
function Dial({
  iso,
  x,
  y,
  z,
  w,
  h,
}: {
  iso: Iso;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}) {
  const [e, f] = iso(x, y, z);
  const r = Math.min(w, h) * 0.34;
  const cx = w / 2;
  const cy = h * 0.52;
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (1.2 - (i / 8) * 1.4);
    return `M${(cx + Math.cos(a) * r * 0.62).toFixed(2)} ${(cy - Math.sin(a) * r * 0.62).toFixed(2)}L${(cx + Math.cos(a) * r * 0.86).toFixed(2)} ${(cy - Math.sin(a) * r * 0.86).toFixed(2)}`;
  }).join("");
  return (
    <g transform={`matrix(0.866 0.5 0 -1 ${e} ${f})`}>
      <circle cx={cx} cy={cy} r={r + 2.2} fill={BRASS[1]} stroke={INK} strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={r} fill={CREAM} stroke={INK} strokeWidth={1} />
      <path d={ticks} stroke={INK} strokeWidth={0.9} fill="none" />
      <path
        d={`M${cx} ${cy - r * 0.55}L${cx + r * 0.5} ${cy + r * 0.28}`}
        stroke={INK}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy - r * 0.55} r={1.6} fill={INK} />
    </g>
  );
}

/** Card 1: an ammeter, a voltmeter and a resistance box joined with leads. */
export function OhmsLawArt() {
  const iso = projector(150, 62);
  // The resistance box is at the back; the two meters stand in front of it, dials toward us.
  const box = { x: 0, y: 0, z: 0, w: 116, d: 34, h: 24 };
  const m1 = { x: 8, y: 52, z: 0, w: 40, d: 15, h: 40 };
  const m2 = { x: 66, y: 52, z: 0, w: 40, d: 15, h: 40 };
  const topZ = box.h;
  const plugs = Array.from({ length: 6 }, (_, i) => iso(box.x + 20 + i * 15.5, box.y + 17, topZ));
  const plate = path([
    iso(box.x + 6, box.y + 5, topZ),
    iso(box.x + box.w - 6, box.y + 5, topZ),
    iso(box.x + box.w - 6, box.y + box.d - 5, topZ),
    iso(box.x + 6, box.y + box.d - 5, topZ),
  ]);
  const t1 = iso(m1.x + 10, m1.y + 4, m1.h);
  const t2 = iso(m1.x + m1.w - 10, m1.y + 4, m1.h);
  const t3 = iso(m2.x + 10, m2.y + 4, m2.h);
  const t4 = iso(m2.x + m2.w - 10, m2.y + 4, m2.h);
  const t5 = iso(box.x + 9, box.y + 8, topZ);
  const t6 = iso(box.x + box.w - 9, box.y + 8, topZ);
  return (
    <Art label="ohms-law" view="62 -14 220 158">
      <Shadows
        iso={iso}
        feet={[
          [box.x, box.y, box.w, box.d],
          [m1.x, m1.y, m1.w, m1.d],
          [m2.x, m2.y, m2.w, m2.d],
        ]}
      />
      <g>
        <Box iso={iso} {...box} colours={MAHOGANY} />
        <Face d={plate} fill={BRASS[0]} w={1.2} />
        {plugs.map(([x, y]) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={5.6} ry={3.2} fill={BRASS[1]} stroke={INK} strokeWidth={1} />
            <rect
              x={x - 2.4}
              y={y - 9}
              width={4.8}
              height={9}
              fill={BAKELITE[1]}
              stroke={INK}
              strokeWidth={1}
            />
            <ellipse
              cx={x}
              cy={y - 9}
              rx={3.6}
              ry={2}
              fill={BAKELITE[0]}
              stroke={INK}
              strokeWidth={1}
            />
          </g>
        ))}
        <Terminal at={t5} />
        <Terminal at={t6} />
      </g>
      <g>
        <Box iso={iso} {...m1} colours={BAKELITE} />
        <Dial iso={iso} x={m1.x} y={m1.y + m1.d} z={0} w={m1.w} h={m1.h} />
        <Terminal at={t1} />
        <Terminal at={t2} />
      </g>
      <g>
        <Box iso={iso} {...m2} colours={BAKELITE} />
        <Dial iso={iso} x={m2.x} y={m2.y + m2.d} z={0} w={m2.w} h={m2.h} />
        <Terminal at={t3} />
        <Terminal at={t4} />
      </g>
      <g>
        <Lead a={t2} b={t3} sag={9} />
        <Lead a={t1} b={t5} sag={-6} />
        <Lead a={t4} b={t6} sag={-4} />
      </g>
    </Art>
  );
}

/** Card 2: a metre bridge, a wire along a metre rule with a jockey, and a block at each end. */
export function MeterBridgeArt() {
  const iso = projector(150, 36);
  const L = 150;
  const board = { x: 0, y: 0, z: 0, w: L, d: 18, h: 6 };
  const blockA = { x: -34, y: -4, z: 0, w: 26, d: 26, h: 17 };
  const blockB = { x: L + 8, y: -4, z: 0, w: 26, d: 26, h: 17 };
  const topZ = board.h;
  const wireZ = 18;
  const rule = Array.from({ length: 31 }, (_, i) => {
    const x = 3 + (i * (L - 6)) / 30;
    const a = iso(x, board.d, topZ);
    const b = iso(x, board.d - (i % 5 === 0 ? 7 : 4), topZ);
    return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }).join("");
  const p1 = iso(5, 6, topZ);
  const p2 = iso(L - 5, 6, topZ);
  const w1 = iso(5, 6, wireZ);
  const w2 = iso(L - 5, 6, wireZ);
  const jx = 84;
  const jock = { x: jx, y: 2, z: wireZ + 2, w: 8, d: 8, h: 11 };
  const tipTop = iso(jx + 4, 6, wireZ + 2);
  const tipEnd = iso(jx + 4, 6, wireZ);
  const ta = iso(blockA.x + 13, blockA.y + 13, blockA.h);
  const tb = iso(blockB.x + 13, blockB.y + 13, blockB.h);
  return (
    <Art label="meter-bridge" view="78 -20 260 187">
      <Shadows
        iso={iso}
        feet={[
          [board.x, board.y, board.w, board.d],
          [blockA.x, blockA.y, blockA.w, blockA.d],
          [blockB.x, blockB.y, blockB.w, blockB.d],
        ]}
      />
      <g>
        <Box iso={iso} {...blockA} colours={BAKELITE} />
        <Terminal at={ta} />
      </g>
      <g>
        <Box iso={iso} {...board} colours={PINE} />
        <Ink d={rule} w={1} />
      </g>
      <g>
        <Ink d={`M${p1[0]} ${p1[1]}L${w1[0]} ${w1[1]}`} w={2.6} c={BRASS[2]} />
        <Ink d={`M${p2[0]} ${p2[1]}L${w2[0]} ${w2[1]}`} w={2.6} c={BRASS[2]} />
        <Ink d={`M${w1[0]} ${w1[1]}L${w2[0]} ${w2[1]}`} w={2.4} c={BRASS[1]} />
        <Terminal at={w1} />
        <Terminal at={w2} />
      </g>
      <g>
        <Box iso={iso} {...jock} colours={BRASS} />
        <Ink d={`M${tipTop[0]} ${tipTop[1]}L${tipEnd[0]} ${tipEnd[1]}`} w={1.6} />
      </g>
      <g>
        <Box iso={iso} {...blockB} colours={BAKELITE} />
        <Terminal at={tb} />
        <Lead a={ta} b={w1} sag={-8} />
        <Lead a={w2} b={tb} sag={-8} />
      </g>
    </Art>
  );
}

/** Card 3: a burette clamped on a stand over a conical flask. */
export function TitrationArt() {
  const iso = projector(150, 190);
  const base = { x: -30, y: -30, z: 0, w: 60, d: 60, h: 8 };
  const bx = 150;
  const tube = `M${bx - 7} 12 V86 L${bx - 2.5} 98 V110 H${bx + 2.5} V98 L${bx + 7} 86 V12Z`;
  const liquid = `M${bx - 6} 46 V86 L${bx - 2} 97 V109 H${bx + 2} V97 L${bx + 6} 86 V46Z`;
  const ticks = Array.from({ length: 9 }, (_, i) => {
    const y = 18 + i * 8;
    return `M${bx - 7} ${y}H${bx - 7 + (i % 2 === 0 ? 6 : 3.5)}`;
  }).join("");
  const rodX = 196;
  const flask = `M${bx - 7} 128 V146 L${bx - 31} 177 Q${bx - 34} 183 ${bx - 26} 183 H${bx + 26} Q${bx + 34} 183 ${bx + 31} 177 L${bx + 7} 146 V128Z`;
  const flaskLiquid = `M${bx - 23} 168 L${bx - 31} 177 Q${bx - 34} 183 ${bx - 26} 183 H${bx + 26} Q${bx + 34} 183 ${bx + 31} 177 L${bx + 23} 168Z`;
  return (
    <Art label="titration" view="-14 -4 328 236">
      <Shadows iso={iso} feet={[[base.x, base.y, base.w, base.d]]} />
      <g>
        <Box iso={iso} {...base} colours={MAHOGANY} />
      </g>
      <g>
        <Face d={`M${rodX - 2.5} 190 V10 H${rodX + 2.5} V190Z`} fill={BAKELITE[1]} w={1.3} />
        <Face d={`M${bx + 8} 56 H${rodX - 2.5} V64 H${bx + 8}Z`} fill={BRASS[1]} w={1.2} />
        <Face d={`M${bx - 9} 52 H${bx + 9} V68 H${bx - 9}Z`} fill={BRASS[0]} w={1.2} />
        <circle cx={rodX} cy={60} r={5.5} fill={BRASS[0]} stroke={INK} strokeWidth={1.2} />
      </g>
      <g>
        <Face d={tube} fill="#f3f5ee" w={1.5} />
        <path d={liquid} fill="#bcd5c2" />
        <Ink d={ticks} w={1} />
        <Face d={`M${bx - 9} 88H${bx + 9}V95H${bx - 9}Z`} fill={BRASS[1]} w={1.2} />
        <Ink d={`M${bx + 9} 91.5H${bx + 18}`} w={2.2} />
      </g>
      <g>
        <Face d={flask} fill="#f3f5ee" w={1.5} />
        <path d={flaskLiquid} fill="#c3dac6" />
        <Ink d={`M${bx - 8.5} 128H${bx + 8.5}`} w={1.6} />
      </g>
    </Art>
  );
}
