import { afterEach, describe, expect, it, vi } from "vitest";
import { jpegDimensions, MAX_LONG_SIDE, toJpeg } from "./toJpeg";

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
});
