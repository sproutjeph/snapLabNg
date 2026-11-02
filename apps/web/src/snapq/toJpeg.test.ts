import { afterEach, describe, expect, it, vi } from "vitest";
import { jpegDimensions, MAX_JPEG_BYTES, MAX_LONG_SIDE, toJpeg } from "./toJpeg";

describe("jpegDimensions", () => {
  it("caps the long side at 2048 px and keeps the aspect", () => {
    expect(jpegDimensions(4096, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(jpegDimensions(1000, 4000)).toEqual({ width: 512, height: 2048 });
    expect(jpegDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(MAX_LONG_SIDE).toBe(2048);
  });
});

describe("toJpeg", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("re-encodes a large image as a JPEG no wider than 2048 px", async () => {
    const drawn: { w: number; h: number }[] = [];
    let canvasW = 0;
    let canvasH = 0;
    const fakeCanvas = {
      get width() {
        return canvasW;
      },
      set width(v: number) {
        canvasW = v;
      },
      get height() {
        return canvasH;
      },
      set height(v: number) {
        canvasH = v;
      },
      getContext: () => ({
        drawImage: (_s: unknown, _x: number, _y: number, w: number, h: number) =>
          drawn.push({ w, h }),
      }),
      toBlob: (cb: (b: Blob | null) => void, type: string) => cb(new Blob(["jpeg"], { type })),
    };
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 4096,
      height: 2048,
      close: () => {},
    }));
    vi.stubGlobal("document", { createElement: () => fakeCanvas });
    vi.stubGlobal("ImageBitmap", class {});

    // source instanceof ImageBitmap is false for the stub bitmap, so close() is skipped.
    const out = await toJpeg(new Blob(["png"], { type: "image/png" }));
    expect(out.type).toBe("image/jpeg");
    expect(canvasW).toBe(2048);
    expect(canvasH).toBe(1024);
    expect(drawn).toEqual([{ w: 2048, h: 1024 }]);
  });

  it("steps quality down, then to 1600 px, while the JPEG is over 1.4 MB", async () => {
    const qualities: (number | undefined)[] = [];
    let canvasW = 0;
    const sizeFor = (quality: number | undefined) => {
      if (canvasW <= 1600) return 500_000;
      if (quality === 0.85) return 2_000_000;
      if (quality === 0.75) return 1_600_000;
      return MAX_JPEG_BYTES + 1;
    };
    const fakeCanvas = {
      get width() {
        return canvasW;
      },
      set width(v: number) {
        canvasW = v;
      },
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (cb: (b: Blob | null) => void, type: string, quality?: number) => {
        qualities.push(quality);
        cb(new Blob([new Uint8Array(sizeFor(quality))], { type }));
      },
    };
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 4096,
      height: 2048,
      close: () => {},
    }));
    vi.stubGlobal("document", { createElement: () => fakeCanvas });
    vi.stubGlobal("ImageBitmap", class {});

    const out = await toJpeg(new Blob(["png"], { type: "image/png" }));
    expect(qualities).toEqual([0.85, 0.75, 0.65, 0.65]);
    expect(canvasW).toBe(1600);
    expect(out.size).toBeLessThanOrEqual(MAX_JPEG_BYTES);
  });

  it("falls back to the <img> decode when createImageBitmap throws", async () => {
    let canvasW = 0;
    const fakeCanvas = {
      get width() {
        return canvasW;
      },
      set width(v: number) {
        canvasW = v;
      },
      height: 0,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (cb: (b: Blob | null) => void, type: string) => cb(new Blob(["jpeg"], { type })),
    };
    class FakeImage {
      naturalWidth = 2000;
      naturalHeight = 1000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("unsupported");
    });
    vi.stubGlobal("document", { createElement: () => fakeCanvas });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:mock",
      revokeObjectURL: () => {},
    });

    const out = await toJpeg(new Blob(["png"], { type: "image/png" }));
    expect(out.type).toBe("image/jpeg");
    expect(canvasW).toBe(2000);
  });
});
