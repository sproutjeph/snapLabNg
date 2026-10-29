// Image-first design targets for the exam redesign (docs/plans/exam-redesign.md, decision D2).
// Generates the mock-up images every later writer builds to, with Meta's Muse Image
// (docs/06). Run from the repo root so Bun loads the server env:
//   bun scripts/design-targets.ts
// The key is read from MODEL_API_KEY and is never printed or written. A target whose .webp
// already exists is skipped, so a rerun never bills twice: to regenerate one, edit its prompt
// below, delete its file and rerun. Outputs: docs/design/exam-redesign/<id>.webp and prompts.md.
// Price: $0.01 per image, 150 RPM.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ENDPOINT = "https://api.meta.ai/v1/images/generations";
const key = process.env.MODEL_API_KEY;
if (!key) {
  console.error("MODEL_API_KEY is not set in the server env (.env at the repo root).");
  process.exit(1);
}
const OUT_DIR = join("docs", "design", "exam-redesign");
mkdirSync(OUT_DIR, { recursive: true });

type Size = "1536x1024" | "1024x1536" | "1792x1024";
type Target = { id: string; size: Size; usedBy: string; prompt: string };

const words = (...parts: string[]) => parts.join(" ");

/** The 3D recipe from docs/plans/exam-redesign.md "The look" (camera, light, ink, materials). */
const SCENE_LOOK = words(
  "Hand-inked illustrated 3D diorama, like a tactile educational board game.",
  "Near-isometric orthographic camera: a 45 degree corner view at 41 degrees elevation,",
  "no perspective convergence, parallel edges stay parallel.",
  "Warm soft daylight: a cream key light (#fff0dc) from the upper left front, a gentle warm fill,",
  "and soft blurred contact shadows in warm brown (#5b4027, about 22 percent opacity) under every",
  "object. Every object has a confident blue-black ink outline (#1d2430): about 3 px on",
  "silhouettes, thinner 1.5 px crease lines where faces meet, slightly hand-drawn.",
  "Matte, slightly rough, hand-painted materials (roughness about 0.9): dark mahogany (#6b3a26)",
  "with visible grain, pale pine (#d9b982), speckled black bakelite (#2b2a2a), brushed brass",
  "(#c79a45), cream paper. The desk is cream paper (#f4ecdc) with a faint graph-paper grid",
  "(#d9cdb2 lines).",
);

/** The apparatus of WASSCE (SC) 2018 Physics Paper 3 Q3B, in our own drawing. */
const APPARATUS = words(
  "The apparatus, exactly these and no others:",
  "(1) a long pale-pine board with a thin bare constantan wire stretched taut between two brass",
  "terminal blocks marked X and Y, and a wooden metre rule with black cm numbers along its front",
  "edge;",
  "(2) two cylindrical dry cells (black and silver, paper-wrapped) in a wooden holder with brass",
  "terminals;",
  "(3) a small plug key marked K: wooden base, brass block, ebonite knob;",
  "(4) an ammeter: square speckled black bakelite case, round glass dial, cream scale 0 to 1 A,",
  "thin black needle, two chunky brass terminals;",
  "(5) a voltmeter in the same style, dial 0 to 3 V;",
  "(6) a long mahogany resistance box with a brass top plate, a row of eight brass blocks with",
  "ebonite-handled brass plugs seated in the gaps, two plugs pulled out and standing beside it,",
  "and a cream printed label reading 1 2 2 5 10 20 20 50 and the ohm sign;",
  "(7) seven soft insulated flexible leads in red, black, green, blue and ochre, each ending in a",
  "brass plug, drooping in gentle sagging curves.",
);

/** Ink-and-paper UI tokens from apps/web/src/styles/tokens.css. */
const UI_LOOK = words(
  "The interface is ink-and-paper, flat and calm:",
  "panels are cream cards (#f8f2e6) with a 1 px #ddd2bd border and 6 px corners;",
  "text is blue-black (#1d2430); headings are a tall condensed uppercase sans with wide letter",
  "spacing; body text is a clean humanist sans; exam question text is a classic serif;",
  "orange (#e0752e) for rings, markers and the primary button; green (#1f6b45) for ticks;",
  "red ink (#b83228) only for examiner marks. Buttons are at least 44 px tall.",
);

const AVOID = words(
  "Avoid photorealism, neon, sci-fi, glossy plastic, lens flare, bloom, dark mode, stock 3D",
  "clutter, extra gadgets, people, watermarks and gibberish text. Keep every piece of text short",
  "and exactly as quoted. It must look hand-inked, illustrated and tactile, never a photograph.",
);

const TARGETS: Target[] = [
  {
    id: "golden-frame",
    size: "1792x1024",
    usedBy: "W1-look, W1-apparatus: the render every later frame is judged against.",
    prompt: words(
      "Hero render of a fully wired school physics practical bench, landscape, no user interface.",
      SCENE_LOOK,
      APPARATUS,
      "The circuit is wired: cells to key to ammeter to resistance box to wire end X, wire end Y",
      "back to the cells, and the voltmeter's two leads run across X and Y. The key is closed with",
      "its plug in; the ammeter needle rests about one third across its scale and the voltmeter",
      "needle about one third across its scale.",
      "Composition: the pine board with wire XY lies along the back from upper left to upper right;",
      "the resistance box sits centre front; the ammeter and voltmeter stand side by side in the",
      "middle row, angled to face the viewer; the cells and key are front left. No lead crosses a",
      "dial face. Big chunky objects fill about 85 percent of the frame with little empty paper.",
      "At the paper edges only: a sharpened pencil, a pink eraser, a closed answer booklet with a",
      "blue-black cover and a scientific calculator, in the same ink outline.",
      "No text except the printed labels on the apparatus.",
      AVOID,
    ),
  },
  {
    id: "question-paper",
    size: "1792x1024",
    usedBy: "W1-paper (QuestionPaper), W2-callouts (the entrance drop and its name tags).",
    prompt: words(
      "A full app screen, landscape: the question paper on the left and the bench on the right,",
      "while the question is being read aloud.",
      UI_LOOK,
      "LEFT, about 38 percent of the width: a cream exam-paper card with a double rule border.",
      "Small tracked caps heading: PHYSICS PAPER 3. Large serif title: Question 3B.",
      "Small grey line: WASSCE-style. Under it, five lines of small serif question text, and one",
      "sentence highlighted with a soft yellow marker stroke, reading exactly: You are provided with",
      "an ammeter, a voltmeter, a resistance box, connecting wires, dry cells and other necessary",
      "materials. Below the text, a small ink-drawn circuit diagram of cells, a key, an ammeter, a",
      "resistance box and a wire XY with a voltmeter across it. Below that, a pill button with a",
      "speaker icon reading Read it to me, then a row of three buttons: Watch it done, Practise with",
      "a guide, Exam conditions (the middle one orange).",
      "RIGHT, about 62 percent: the 3D bench, in this recipe: ",
      SCENE_LOOK,
      "The apparatus is landing as each item is named. The pine board with wire XY, the ammeter and",
      "the voltmeter have already settled, each with a small cream name tag on a thin ink leader",
      "line ending in a tiny ring: Ammeter, Voltmeter. The ink-outlined resistance box is caught",
      "in mid-air a little above the desk, with a faint curved motion arc, a small dust puff ready",
      "below and a soft oval shadow on the paper. Where the dry cells, key and leads will land,",
      "faint dotted pencil outlines on the desk. The rest of the desk is empty paper grid.",
      AVOID,
    ),
  },
  {
    id: "watch-mode",
    size: "1792x1024",
    usedBy:
      "W1-director (Player), W2-watch, W2-callouts: Watch mid-demo with callouts and captions.",
    prompt: words(
      "A full app screen of Watch mode, landscape, the lab performing the practical by itself.",
      UI_LOOK,
      "Centre: the 3D bench filling the frame, in this recipe: ",
      SCENE_LOOK,
      APPARATUS,
      "Four of the seven leads are already drawn in place. The fifth lead is being drawn right now:",
      "it grows out of the ammeter's negative terminal toward the resistance box, and a hand-inked",
      "fountain-pen nib cursor sits at its growing tip. The two terminals involved each have a",
      "double orange ring. A cream callout chip on a thin leader line reads Lead 5 of 7, with a",
      "smaller second line: Ammeter to resistance box. The three leads still to come are not",
      "drawn yet.",
      "Top left: a small cream chip: Watch, and under it a small note: Demonstration bench. Your",
      "own bench will give different readings.",
      "Top right: Stage 4 of 11. Right edge: a slim cream panel titled Connect the circuit with a",
      "checklist of five rows, each with a tiny thumbnail, the first three ticked in green.",
      "Bottom centre: a dark ink pill (#1d2430) caption bar with cream text: Now join the ammeter to",
      "the resistance box, in series. Below it a player pill with previous, pause, next buttons, a",
      "speed button reading 1x, and a thin progress bar with eleven small stage ticks, four filled.",
      AVOID,
    ),
  },
  {
    id: "practise-mode",
    size: "1792x1024",
    usedBy: "W2-guide (rings, one instruction, hint ladder), W2-callouts (focus fade).",
    prompt: words(
      "A full app screen of Practise mode, landscape: the student's own bench with a voice guide",
      "giving one instruction.",
      UI_LOOK,
      "Centre: a closer 3D shot of just the ammeter, the resistance box and the leads between them,",
      "in this recipe: ",
      SCENE_LOOK,
      "Exactly two terminals are ringed: the ammeter's negative terminal and the resistance box's",
      "first terminal, each with a pulsing double orange ring and a small cream tag on a leader",
      "line: Ammeter, negative and Resistance box, first terminal. Everything else on the bench",
      "(voltmeter, cells, key, wire board) is faded about 45 percent toward the paper colour with",
      "halved ink lines, so the two rings are the only thing that pops. No lead is drawn between",
      "the two ringed terminals yet.",
      "Top left: a cream chip: Practise, and Step 3 of 11 with eleven small progress dots.",
      "Top right: a small speaker icon button. Bottom left: one cream instruction card with a",
      "numeral 3 in an orange circle and one sentence: Connect the negative terminal of the ammeter",
      "to the resistance box. Under it three buttons: Repeat (speaker icon), Hint, Show me.",
      "No player controls, no readings, no numbers on the dials.",
      AVOID,
    ),
  },
  {
    id: "results-sheet",
    size: "1536x1024",
    usedBy: "W1-paper (Results): marks and the per-row 'you wrote / meter showed' check.",
    prompt: words(
      "A full app screen of the results sheet after hand-in, landscape, drawn like a marked exam",
      "script on cream paper (#f4ecdc) with a faint graph grid. No 3D scene.",
      UI_LOOK,
      "Top left: tracked caps Results, then the serif title Ohm's law (V-I). Top right: a big",
      "hand-written red-ink score circled, reading 18 / 21, with a small red tick beside it.",
      "LEFT column: marks grouped by rule in six rows with small right-aligned numbers and green",
      "ticks: Setting up 3 / 3, Readings 5 / 6, Graph 4 / 4, Slope 3 / 3, Precautions 2 / 2,",
      "Accuracy 1 / 3 (this row in red ink with a short note).",
      "RIGHT, a card titled Check against your apparatus, a table with columns R (ohm), I you wrote,",
      "I meter showed, V you wrote, V meter showed, and a last column with a green tick or a red",
      "cross. Six rows, exactly: R 5, I 0.33, 0.33, V 1.15, 1.15; R 10, I 0.22, 0.22, V 0.77, 0.77;",
      "R 20, I 0.13, 0.13, V 0.44, 0.44; R 30, I 0.09, 0.09, V you wrote 0.40, meter showed 0.31;",
      "R 40, I 0.07, 0.07, V 0.23, 0.23; R 60, I 0.05, 0.05, V 0.16, 0.16. Five rows get a green",
      "tick; the R 30 row gets a red cross drawn like an ink X, and a tiny red-ink hint under the",
      "table: Read straight on, avoid parallax. Then a line: Your slope 3.6 ohm. The wire is",
      "3.5 ohm.",
      "Bottom: two buttons, Watch the demonstration again and Try again on a new bench (orange).",
      "A small ink-drawn graph thumbnail with plotted crosses and a ruled line sits bottom left.",
      AVOID,
    ),
  },
  {
    id: "phone-portrait",
    size: "1024x1536",
    usedBy: "All UI slices: the portrait layout (compact bench, bottom sheet, 44 px hit targets).",
    prompt: words(
      "The full screen of a phone app in portrait, edge to edge. It is the screen itself, not a",
      "photo or a mock-up of a phone: no bezel, no hand, no device frame.",
      UI_LOOK,
      "Top bar, a thin cream strip: the title Ohm's law (V-I), a chip Practise, and a small speaker",
      "icon.",
      "Upper 62 percent: the 3D bench in this recipe, tightly framed so a few chunky objects fill",
      "the width: ",
      SCENE_LOOK,
      "The desk is one flat sheet of graph paper: no walls, no room corner, no horizon.",
      "Show exactly four items with a few leads drawn between them: an ammeter and a voltmeter, both",
      "square speckled black bakelite cases with round glass dials (cream scale, thin needle) and",
      "chunky brass terminals; a long dark mahogany resistance box with a brass top plate and a row",
      "of brass blocks with black ebonite-handled plugs; and two black-and-silver dry cells in a",
      "small wooden holder. Two terminals are ringed with orange double rings, one small cream tag",
      "each.",
      "Lower 38 percent: a cream bottom sheet with a rounded top edge: Step 3 of 11 with progress",
      "dots, one instruction in large readable type: Connect the negative terminal of the ammeter",
      "to the resistance box. Under it three large rounded buttons side by side: Repeat, Hint,",
      "Show me, each at least 44 px tall, comfortable for a thumb.",
      AVOID,
    ),
  },
  {
    id: "materials-closeup",
    size: "1536x1024",
    usedBy: "W1-apparatus: the materials kit (mahogany, pine, bakelite, brass, paper label).",
    prompt: words(
      "A tight close-up still life of the apparatus materials, landscape, no user interface.",
      SCENE_LOOK,
      "Foreground right: the top end of the mahogany resistance box with visible wood grain, a",
      "brushed-brass top plate, four brass blocks with ebonite-handled plugs seated, one plug",
      "pulled out showing the tapered brass shank, and a cream printed paper label with the numbers",
      "5 10 20 and the ohm sign. Background left: the speckled black bakelite ammeter case with a",
      "round glass dial (cream scale 0 to 1 A, thin needle, a soft curved highlight on the glass)",
      "and two chunky brass terminals with knurled nuts and washers, one with a red ring. A black",
      "lead ends in a brass plug going into the terminal. A strip of pale pine board with a bit of",
      "thin bare constantan wire and a wooden metre rule edge with tiny black ticks sits at the",
      "bottom left. Show the hand-inked outline weight clearly on rounded, bevelled edges.",
      "Each material reads distinct: grain, speckle, brushed metal, printed paper.",
      AVOID,
    ),
  },
  {
    id: "metre-bridge",
    size: "1792x1024",
    usedBy: "W2-hero: the metre bridge (the hero) in the same look.",
    prompt: words(
      "Hero render of a metre bridge practical, landscape, no user interface.",
      SCENE_LOOK,
      "The apparatus, exactly these: a long pale-pine board with a wooden metre rule printed along",
      "its front edge (black cm numbers); a thin bare constantan wire stretched taut along the rule",
      "from a brass terminal A at the left end to a brass terminal C at the right end; behind the",
      "wire, two wide copper strips shaped like a flat letter E with two gaps, brass terminals on",
      "the strips; in the left gap a mahogany resistance box with brass plugs and a cream label,",
      "in the right gap a small bare coil of wire on a wooden block as the unknown resistance;",
      "a centre-zero galvanometer (speckled black bakelite case, round glass dial, white scale with",
      "zero in the middle, needle exactly at zero); a brass jockey, a wooden handle with a brass",
      "knife edge, touching the wire; a dry cell in a holder and a small plug key marked K; and six",
      "soft insulated leads in red, black, green and blue drooping in gentle curves.",
      "Composition: the board runs along the diagonal across the frame, the galvanometer at the",
      "back right, chunky objects filling about 85 percent of the frame. At the paper edges only:",
      "a pencil, an eraser and a closed answer booklet. No text except the printed labels.",
      AVOID,
    ),
  },
  {
    id: "picker",
    size: "1536x1024",
    usedBy: "W1-paper (home/**): 'Choose a practical' with ink-drawn cards.",
    prompt: words(
      "A full app screen, landscape: the home page where the student chooses a practical, on",
      "cream paper (#f4ecdc) with a faint graph grid.",
      UI_LOOK,
      "Top left: tracked caps SnapLab NG. Large serif heading: Choose a practical.",
      "Three tall cream cards side by side, each with a hand-inked near-isometric illustration at",
      "the top, in this recipe: ",
      SCENE_LOOK,
      "Card 1 illustration: an ammeter, a voltmeter and a resistance box joined with leads. Title",
      "Ohm's law (V-I). Small grey line: WASSCE-style, Physics Paper 3. Three small buttons: Watch,",
      "Practise (orange), Exam.",
      "Card 2 illustration: a metre bridge with a wire along a metre rule and a jockey. Title:",
      "Metre bridge. Two buttons: Snap my practical (orange), Try a demo page.",
      "Card 3 illustration: a burette on a stand over a conical flask, the card faded 45 percent",
      "toward the paper colour. Title: Titration. A small grey label: Coming soon.",
      "No WAEC logo, no scanned paper, no photographs.",
      AVOID,
    ),
  },
];

async function generate(t: Target): Promise<"billed" | "skipped" | "refused" | "failed"> {
  const file = join(OUT_DIR, `${t.id}.webp`);
  if (existsSync(file)) {
    console.log(`${t.id}: exists, skipped`);
    return "skipped";
  }
  const body = JSON.stringify({
    model: "muse-image-1.0",
    prompt: t.prompt,
    n: 1,
    size: t.size,
    output_format: "webp",
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      console.error(`${t.id}: fetch error on attempt ${attempt}: ${String(e)}`);
      continue;
    }
    const text = await res.text();
    let json: {
      data?: { b64_json?: string }[];
      error?: { code?: string; message?: string };
      code?: string;
      message?: string;
    } = {};
    try {
      json = JSON.parse(text);
    } catch {
      // keep the empty object; the status below says what happened
    }
    if (res.ok) {
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        console.error(`${t.id}: 200 but no data[0].b64_json`);
        return "failed";
      }
      writeFileSync(file, Buffer.from(b64, "base64"));
      console.log(`${t.id}: saved (${Math.round((performance.now() - t0) / 1000)} s)`);
      return "billed";
    }
    const code = json.error?.code ?? json.code ?? "";
    const message = (json.error?.message ?? json.message ?? "").slice(0, 300);
    if (code === "content_policy_violation") {
      console.error(`${t.id}: REFUSED by content policy. ${message}`);
      return "refused";
    }
    console.error(`${t.id}: HTTP ${res.status} ${code} ${message}`);
    if (res.status !== 503 && res.status !== 429) return "failed";
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  return "failed";
}

function writePrompts() {
  const lines = [
    "# Exam redesign: design targets",
    "",
    "Generated by `scripts/design-targets.ts` with `muse-image-1.0` (docs/plans/exam-redesign.md, D2).",
    "These images are the visual target for every later writer: build toward them, do not copy",
    "pixels. Text inside the images is approximate; the wording in the plan is the truth.",
    "",
  ];
  for (const t of TARGETS) {
    lines.push(`## ${t.id}`, "", `- File: \`${t.id}.webp\` (${t.size})`, `- Used by: ${t.usedBy}`);
    lines.push("", "```text", t.prompt, "```", "");
  }
  writeFileSync(join(OUT_DIR, "prompts.md"), lines.join("\n"));
}

writePrompts();
const outcomes: Record<string, string> = {};
const queue = [...TARGETS];
const workers = Array.from({ length: 3 }, async () => {
  for (let t = queue.shift(); t; t = queue.shift()) outcomes[t.id] = await generate(t);
});
await Promise.all(workers);

const billed = Object.values(outcomes).filter((o) => o === "billed").length;
console.table(outcomes);
console.log(`Billed ${billed} image(s), about $${(billed * 0.01).toFixed(2)}.`);
if (Object.values(outcomes).some((o) => o === "refused" || o === "failed")) process.exit(1);
