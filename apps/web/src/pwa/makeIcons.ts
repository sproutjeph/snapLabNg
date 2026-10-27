/**
 * Generates the PWA icons in `apps/web/public/icons/` (run with bun:
 * `bun run apps/web/src/pwa/makeIcons.ts`). Draws a flask-and-wire glyph in
 * cyan on `#0b0d12` and encodes PNGs by hand (CRC32 + `node:zlib`), so the
 * icons need no image dependency or external asset.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG: [number, number, number] = [0x0b, 0x0d, 0x12];
const CYAN: [number, number, number] = [0x22, 0xd3, 0xee];
const DEEP: [number, number, number] = [0x0e, 0x74, 0x90];

type Rgb = [number, number, number];

/** Colour of the glyph at relative point (u, v); the glyph is scaled about the centre. */
function glyph(u: number, v: number, scale: number): Rgb {
  const x = 0.5 + (u - 0.5) / scale;
  const y = 0.5 + (v - 0.5) / scale;
  if (x < 0 || x > 1 || y < 0 || y > 1) return BG;

  // Metre-bridge wire: a horizontal rule with two contact ticks.
  if (y >= 0.855 && y <= 0.885 && x >= 0.16 && x <= 0.84) return CYAN;
  if (y >= 0.825 && y <= 0.915 && ((x >= 0.29 && x <= 0.315) || (x >= 0.685 && x <= 0.71))) {
    return CYAN;
  }

  // Flask: neck plus a conical body, drawn as an outline with liquid inside.
  const inNeck = x >= 0.43 && x <= 0.57 && y >= 0.15 && y <= 0.42;
  const bodyHalf = 0.07 + Math.max(0, y - 0.38) * 0.62;
  const inBody = y > 0.38 && y <= 0.79 && Math.abs(x - 0.5) <= bodyHalf;
  if (!inNeck && !inBody) return BG;

  const innerNeck = x >= 0.465 && x <= 0.535 && y >= 0.185 && y <= 0.42;
  const innerHalf = 0.07 + Math.max(0, y - 0.38) * 0.62 - 0.035;
  const innerBody = y > 0.415 && y <= 0.755 && Math.abs(x - 0.5) <= innerHalf;
  if (!innerNeck && !innerBody) return CYAN;
  if (innerBody && y >= 0.6) return DEEP;
  return BG;
}

function rasterise(size: number, scale: number): Uint8Array {
  const data = new Uint8Array(size * (1 + size * 4));
  let offset = 0;
  for (let row = 0; row < size; row++) {
    data[offset++] = 0; // filter: none
    for (let col = 0; col < size; col++) {
      const [r, g, b] = glyph((col + 0.5) / size, (row + 0.5) / size, scale);
      data[offset++] = r;
      data[offset++] = g;
      data[offset++] = b;
      data[offset++] = 0xff;
    }
  }
  return data;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(size: number, scale: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rasterise(size, scale))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

const ICONS_DIR = new URL("../../public/icons/", import.meta.url);
mkdirSync(ICONS_DIR, { recursive: true });
writeFileSync(new URL("icon-192.png", ICONS_DIR), encodePng(192, 1));
writeFileSync(new URL("icon-512.png", ICONS_DIR), encodePng(512, 1));
writeFileSync(new URL("icon-maskable-512.png", ICONS_DIR), encodePng(512, 0.78));
console.log("Wrote icon-192.png, icon-512.png and icon-maskable-512.png");
