import type { TerminalId } from "@snaplab/engine";

// "Circuit for this practical" (docs/plans/ohms-law-vi.md, "The question"): our own drawing of
// the corrected diagram, E → K → A → R → X–Y → back to E, with V across X and Y. No WAEC scan.
// Laid out as the bench is: the loop runs leftward along the top from the cells (E+ on their
// left) through K, A and R, down to X, along the wire to Y and back up to E−; the voltmeter sits
// below the wire. Each symbol carries data-part (an engine PartId); each connecting line carries
// data-lead="<a>|<b>" with the pair sorted (diagramLeadKey), and starts as a dashed pencil line.
// CircuitDiagram sets data-made="1" on a line once she has made that lead (solid ink) and
// data-hl="1" on a highlighted part.

/** The data-lead key of a terminal pair: the two ids sorted, joined by "|". */
export const diagramLeadKey = (a: TerminalId, b: TerminalId): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

export const OHMS_LAW_DIAGRAM_CAPTION = "Circuit for this practical";

const INK = "#1d2430";
const PENCIL = "#9a958a";
const ACCENT = "#e0752e";

/** A small filled dot where a lead meets a terminal. */
const dot = (x: number, y: number) => `<circle class="dg-dot" cx="${x}" cy="${y}" r="2.6"/>`;

export const OHMS_LAW_DIAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 250" role="img" aria-labelledby="dg-ohm-title dg-ohm-desc" class="snap-circuit-diagram">
<title id="dg-ohm-title">${OHMS_LAW_DIAGRAM_CAPTION}</title>
<desc id="dg-ohm-desc">Two cells E, key K, ammeter A and resistance box R in series with the wire XY; voltmeter V connected across X and Y.</desc>
<style>
.snap-circuit-diagram { font-family: "Barlow Condensed", "Arial Narrow", sans-serif; }
.snap-circuit-diagram .dg-lead { fill: none; stroke: ${PENCIL}; stroke-width: 2; stroke-dasharray: 5 4; stroke-linecap: round; stroke-linejoin: round; }
.snap-circuit-diagram .dg-lead[data-made="1"] { stroke: ${INK}; stroke-dasharray: none; }
.snap-circuit-diagram .dg-part { stroke: ${INK}; fill: none; stroke-width: 2; stroke-linecap: round; cursor: pointer; }
.snap-circuit-diagram .dg-part[data-hl="1"] { stroke: ${ACCENT}; stroke-width: 3; }
.snap-circuit-diagram .dg-part[data-hl="1"] text { fill: ${ACCENT}; }
.snap-circuit-diagram .dg-part .dg-thick { stroke-width: 5; }
.snap-circuit-diagram .dg-part[data-hl="1"] .dg-thick { stroke-width: 6; }
.snap-circuit-diagram .dg-hit { fill: transparent; stroke: none; }
.snap-circuit-diagram text { fill: ${INK}; stroke: none; font-size: 15px; font-weight: 600; text-anchor: middle; }
.snap-circuit-diagram .dg-sign { font-size: 12px; font-weight: 500; }
.snap-circuit-diagram .dg-dot { fill: ${INK}; stroke: none; }
</style>

<path class="dg-lead" data-lead="${diagramLeadKey("E+", "K1")}" d="M262 50 H225"/>
<path class="dg-lead" data-lead="${diagramLeadKey("K2", "A+")}" d="M185 50 H164"/>
<path class="dg-lead" data-lead="${diagramLeadKey("A-", "R1")}" d="M116 50 H95"/>
<path class="dg-lead" data-lead="${diagramLeadKey("R2", "X")}" d="M35 50 H20 V160 H70"/>
<path class="dg-lead" data-lead="${diagramLeadKey("Y", "E-")}" d="M306 50 H340 V160 H290"/>
<path class="dg-lead" data-lead="${diagramLeadKey("V+", "X")}" d="M156 215 H70 V160"/>
<path class="dg-lead" data-lead="${diagramLeadKey("V-", "Y")}" d="M204 215 H290 V160"/>

<g class="dg-part" data-part="cells">
<rect class="dg-hit" x="258" y="18" width="52" height="52"/>
<path d="M262 50 H272 M278 50 H290 M296 50 H306"/>
<path d="M272 36 V64 M290 36 V64"/>
<path class="dg-thick" d="M278 43 V57 M296 43 V57"/>
<text x="284" y="28">E</text>
<text class="dg-sign" x="266" y="40">+</text>
${dot(262, 50)}${dot(306, 50)}
</g>

<g class="dg-part" data-part="key">
<rect class="dg-hit" x="182" y="18" width="46" height="46"/>
<path d="M185 50 H195 M215 50 H225"/>
<circle cx="205" cy="50" r="10"/>
<circle class="dg-dot" cx="205" cy="50" r="2.4"/>
<text x="205" y="30">K</text>
${dot(185, 50)}${dot(225, 50)}
</g>

<g class="dg-part" data-part="ammeter">
<rect class="dg-hit" x="113" y="18" width="54" height="52"/>
<path d="M116 50 H126 M154 50 H164"/>
<circle cx="140" cy="50" r="14"/>
<text x="140" y="55.5">A</text>
<text class="dg-sign" x="160" y="40">+</text>
<text class="dg-sign" x="120" y="40">−</text>
${dot(116, 50)}${dot(164, 50)}
</g>

<g class="dg-part" data-part="box">
<rect class="dg-hit" x="32" y="18" width="66" height="54"/>
<path d="M35 50 H45 M85 50 H95"/>
<rect x="45" y="42" width="40" height="16"/>
<path d="M42 66 L86 32 M86 32 L76 33.5 M86 32 L83.5 41.5"/>
<text x="65" y="30">R</text>
${dot(35, 50)}${dot(95, 50)}
</g>

<g class="dg-part" data-part="wire">
<rect class="dg-hit" x="62" y="136" width="236" height="34"/>
<path d="M70 160 H80 M280 160 H290"/>
<rect x="80" y="155" width="200" height="10"/>
<text x="70" y="148">X</text>
<text x="290" y="148">Y</text>
${dot(70, 160)}${dot(290, 160)}
</g>

<g class="dg-part" data-part="voltmeter">
<rect class="dg-hit" x="152" y="192" width="56" height="46"/>
<path d="M156 215 H166 M194 215 H204"/>
<circle cx="180" cy="215" r="14"/>
<text x="180" y="220.5">V</text>
<text class="dg-sign" x="161" y="205">+</text>
<text class="dg-sign" x="199" y="205">−</text>
${dot(156, 215)}${dot(204, 215)}
</g>
</svg>`;
