/**
 * Aspect ratio (`height / width`) of the synthetic G1 exercise-book page.
 */
export const G1_PAGE_ASPECT = 4 / 3;

const PAGE_W = 960;
const PAGE_H = Math.round(PAGE_W * G1_PAGE_ASPECT); // 1280

let cachedDataUrl: string | null = null;

/**
 * Renders the synthetic G1 flawed metre-bridge exercise-book page (docs/15 §5, docs/11 §2)
 * onto an offscreen canvas and returns a PNG data URL.
 * Every drawn region lines up with the normalized 0..1 evidence boxes in `g1Sheet.ts`.
 */
export function createG1PageDataUrl(): string {
  if (cachedDataUrl) {
    return cachedDataUrl;
  }
  if (typeof document === "undefined") {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 1280'/>";
  }

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 960 1280'/>";
  }

  const px = (nx: number) => nx * PAGE_W;
  const py = (ny: number) => ny * PAGE_H;

  // 1. Exercise-book cream paper background
  ctx.fillStyle = "#faf6ec";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // Subtle horizontal ruled lines across the page
  ctx.strokeStyle = "rgba(59, 130, 246, 0.22)";
  ctx.lineWidth = 1;
  for (let y = py(0.08); y < PAGE_H; y += py(0.02)) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PAGE_W, y);
    ctx.stroke();
  }

  // Left vertical red margin line
  ctx.strokeStyle = "rgba(220, 38, 38, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px(0.055), 0);
  ctx.lineTo(px(0.055), PAGE_H);
  ctx.stroke();

  const biro = "#1e3a8a";
  const biroMuted = "#1e40af";
  const pencil = "#334155";
  const handFont = '"Comic Sans MS", "Bradley Hand", "Chalkboard SE", cursive, sans-serif';

  // 2. Top metadata & heading
  ctx.fillStyle = biroMuted;
  ctx.font = `600 15px ${handFont}`;
  ctx.textBaseline = "middle";
  ctx.fillText("SUBJECT: Physics Practical     DATE: 23/10/2026", px(0.07), py(0.035));

  ctx.fillStyle = biro;
  ctx.font = `700 21px ${handFont}`;
  ctx.fillText("QUESTION 3 — METRE BRIDGE", px(0.07), py(0.062));

  // 3. Hand-drawn metre bridge circuit diagram (y = 0.09..0.26, deliberately missing key K)
  ctx.strokeStyle = biro;
  ctx.fillStyle = biro;
  ctx.lineWidth = 2.2;

  // Top cell loop from A (0.14, 0.23) up to y = 0.108 and down to C (0.82, 0.23)
  ctx.beginPath();
  ctx.moveTo(px(0.14), py(0.23));
  ctx.lineTo(px(0.14), py(0.108));
  ctx.lineTo(px(0.39), py(0.108));
  ctx.moveTo(px(0.42), py(0.108));
  ctx.lineTo(px(0.82), py(0.108));
  ctx.lineTo(px(0.82), py(0.23));
  ctx.stroke();

  // Leclanché cell E plates at x = 0.39..0.42, y = 0.108
  ctx.beginPath();
  ctx.lineWidth = 2.6;
  ctx.moveTo(px(0.39), py(0.092));
  ctx.lineTo(px(0.39), py(0.124));
  ctx.lineWidth = 4;
  ctx.moveTo(px(0.415), py(0.098));
  ctx.lineTo(px(0.415), py(0.118));
  ctx.stroke();
  ctx.font = `600 14px ${handFont}`;
  ctx.fillText("E (1.5 V)", px(0.305), py(0.095));

  // Left and right bridge arms between A (0.14, 0.23) -> B (0.48, 0.155) -> C (0.82, 0.23)
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(px(0.14), py(0.23));
  ctx.lineTo(px(0.24), py(0.155));
  ctx.moveTo(px(0.36), py(0.155));
  ctx.lineTo(px(0.6), py(0.155));
  ctx.moveTo(px(0.72), py(0.155));
  ctx.lineTo(px(0.82), py(0.23));
  ctx.stroke();

  // Resistance box R rectangle (0.24..0.36, 0.142..0.168)
  ctx.strokeRect(px(0.24), py(0.142), px(0.12), py(0.026));
  ctx.fillText("R (Ω)", px(0.275), py(0.155));

  // Unknown resistor X rectangle (0.60..0.72, 0.142..0.168)
  ctx.strokeRect(px(0.6), py(0.142), px(0.12), py(0.026));
  ctx.fillText("X", px(0.65), py(0.155));

  // Junction B, Galvanometer G, and Jockey J down to wire AC (y = 0.23)
  ctx.fillText("B", px(0.475), py(0.142));
  ctx.beginPath();
  ctx.moveTo(px(0.48), py(0.155));
  ctx.lineTo(px(0.48), py(0.178));
  ctx.moveTo(px(0.48), py(0.208));
  ctx.lineTo(px(0.48), py(0.23));
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px(0.48), py(0.193), px(0.018), 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillText("G", px(0.473), py(0.194));
  ctx.fillText("J", px(0.492), py(0.22));

  // Bridge slide wire AC at y = 0.23
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px(0.14), py(0.23));
  ctx.lineTo(px(0.82), py(0.23));
  ctx.stroke();
  ctx.fillText("A (0 cm)", px(0.075), py(0.232));
  ctx.fillText("C (100 cm)", px(0.83), py(0.232));
  ctx.font = `500 14px ${handFont}`;
  ctx.fillText("← l = AB →", px(0.28), py(0.248));

  // 4. Results Table (x = 0.07..0.85, y = 0.30..0.54)
  const colX = [0.07, 0.25, 0.45, 0.67, 0.85] as const;
  const rowY = [0.3, 0.34, 0.38, 0.42, 0.46, 0.5, 0.54] as const;

  ctx.strokeStyle = biro;
  ctx.lineWidth = 2;
  for (const ry of rowY) {
    ctx.beginPath();
    ctx.moveTo(px(colX[0]), py(ry));
    ctx.lineTo(px(colX[4]), py(ry));
    ctx.stroke();
  }
  for (const cx of colX) {
    ctx.beginPath();
    ctx.moveTo(px(cx), py(rowY[0]));
    ctx.lineTo(px(cx), py(rowY[6]));
    ctx.stroke();
  }

  const headers = ["R (Ω)", "l (cm)", "R⁻¹ (Ω⁻¹)", "l⁻¹"];
  const rows = [
    ["1.0", "25.3", "1.00", "0.0395"],
    ["2.0", "39.8", "0.500", "0.0251"],
    ["3.0", "50.2", "0.333", "0.02"],
    ["4.0", "57", "0.250", "0.0175"],
    ["5.0", "62.4", "0.200", "0.0160"],
  ];

  ctx.textAlign = "center";
  ctx.font = `700 17px ${handFont}`;
  for (let c = 0; c < 4; c++) {
    const left = colX[c] ?? 0;
    const right = colX[c + 1] ?? 0;
    const cx = (left + right) / 2;
    ctx.fillText(headers[c] ?? "", px(cx), py(0.32));
  }

  ctx.font = `600 17px ${handFont}`;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const top = rowY[r + 1] ?? 0;
    const bottom = rowY[r + 2] ?? 0;
    const cy = (top + bottom) / 2;
    for (let c = 0; c < 4; c++) {
      const left = colX[c] ?? 0;
      const right = colX[c + 1] ?? 0;
      const cx = (left + right) / 2;
      ctx.fillText(row[c] ?? "", px(cx), py(cy));
    }
  }
  ctx.textAlign = "left";

  // 5. Lower-left slope, intercept & evaluation (x = 0.07..0.45, y = 0.60..0.76)
  ctx.fillStyle = biro;
  ctx.font = `600 14.5px ${handFont}`;
  ctx.fillText("s = (0.0175 − 0.0160) ÷ (0.250 − 0.200) = 0.030", px(0.07), py(0.618));
  ctx.font = `600 16px ${handFont}`;
  ctx.fillText("c = 0.010", px(0.07), py(0.678));
  ctx.fillText("X = s/c = 0.030 ÷ 0.010 = 3.0 Ω", px(0.07), py(0.738));

  // 6. Small pencil graph in the lower right (x = 0.51..0.81, y = 0.57..0.80)
  const gx0 = px(0.51);
  const gy0 = py(0.57);
  const gw = px(0.3);
  const gh = py(0.23);

  ctx.fillStyle = "#f4f9f5";
  ctx.fillRect(gx0, gy0, gw, gh);

  // Graph-sheet millimeter grid
  ctx.strokeStyle = "rgba(16, 185, 129, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const x = gx0 + (gw * i) / 16;
    ctx.beginPath();
    ctx.moveTo(x, gy0);
    ctx.lineTo(x, gy0 + gh);
    ctx.stroke();
  }
  for (let j = 0; j <= 12; j++) {
    const y = gy0 + (gh * j) / 12;
    ctx.beginPath();
    ctx.moveTo(gx0, y);
    ctx.lineTo(gx0 + gw, y);
    ctx.stroke();
  }

  // Graph axes inside the small graph box: origin at (0.55, 0.76), top at y = 0.60, right at x = 0.79
  const ox = px(0.55);
  const oy = py(0.76);
  const axRight = px(0.79);
  const axTop = py(0.6);

  ctx.strokeStyle = pencil;
  ctx.fillStyle = pencil;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox, axTop);
  ctx.lineTo(ox, oy);
  ctx.lineTo(axRight, oy);
  ctx.stroke();

  // Axis labels (vertical axis missing unit "cm⁻¹")
  ctx.font = `700 15px ${handFont}`;
  ctx.fillText("l⁻¹", px(0.532), py(0.595));
  ctx.font = `600 14px ${handFont}`;
  ctx.fillText("R⁻¹ (Ω⁻¹)", px(0.675), py(0.782));
  ctx.font = `500 12px ${handFont}`;
  ctx.fillText("0", px(0.535), py(0.772));
  ctx.fillText("1.0", px(0.77), py(0.772));
  ctx.fillText("0.04", px(0.515), py(0.612));

  const mapGraphPt = (rInv: number, lInv: number): [number, number] => [
    ox + (rInv / 1.0) * (axRight - ox),
    oy - (lInv / 0.04) * (oy - axTop),
  ];

  // Best-fit line from (0, 0.010) to (1.00, 0.0395)
  const [lx0, ly0] = mapGraphPt(0, 0.01);
  const [lx1, ly1] = mapGraphPt(1.0, 0.0395);
  ctx.strokeStyle = pencil;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(lx0, ly0);
  ctx.lineTo(lx1, ly1);
  ctx.stroke();

  // Plotted points (×) from her table
  const graphPts: ReadonlyArray<readonly [number, number]> = [
    [1.0, 0.0395],
    [0.5, 0.0251],
    [0.333, 0.02],
    [0.25, 0.0175],
    [0.2, 0.016],
  ];
  for (const [rInv, lInv] of graphPts) {
    const [ptX, ptY] = mapGraphPt(rInv, lInv);
    ctx.beginPath();
    ctx.moveTo(ptX - 4, ptY - 4);
    ctx.lineTo(ptX + 4, ptY + 4);
    ctx.moveTo(ptX + 4, ptY - 4);
    ctx.lineTo(ptX - 4, ptY + 4);
    ctx.stroke();
  }

  // Small slope triangle between neighbouring points R⁻¹ = 0.200 and R⁻¹ = 0.250
  const [tx0, ty0] = mapGraphPt(0.2, 0.016);
  const [tx1, ty1] = mapGraphPt(0.25, 0.0175);
  ctx.strokeStyle = pencil;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(tx0, ty0);
  ctx.lineTo(tx1, ty0);
  ctx.lineTo(tx1, ty1);
  ctx.stroke();
  ctx.setLineDash([]);

  // 7. Precautions at the bottom of the page (y = 0.85..0.955)
  ctx.fillStyle = biro;
  ctx.font = `700 17px ${handFont}`;
  ctx.fillText("Precautions:", px(0.07), py(0.855));

  ctx.font = `600 16px ${handFont}`;
  ctx.fillText("1. Avoid parallax error when reading the metre rule.", px(0.07), py(0.891));
  ctx.fillText(
    "2. I slid the jockey gently along the wire to find the balance point.",
    px(0.07),
    py(0.937),
  );

  cachedDataUrl = canvas.toDataURL("image/png");
  return cachedDataUrl;
}
