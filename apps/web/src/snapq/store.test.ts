import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSnappedPaper } from "../learn/paper/snapContext";
import { setSnappedPaper } from "./store";

describe("setSnappedPaper", () => {
  afterEach(() => {
    setSnappedPaper(null);
    vi.restoreAllMocks();
  });

  it("revokes the replaced paper's blob URLs, never the /samples/ paths", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const base = demoSnappedPaper();
    setSnappedPaper({ ...base, photos: ["blob:a", "/samples/q3b-diagram.jpg"] });
    setSnappedPaper({ ...base, photos: ["blob:b"] });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:a");
  });

  it("revokes nothing when the same paper is set again", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const p = { ...demoSnappedPaper(), photos: ["blob:a"] };
    setSnappedPaper(p);
    setSnappedPaper(p);
    expect(revoke).not.toHaveBeenCalled();
  });
});
