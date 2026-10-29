import { describe, expect, it } from "vitest";
import { practicalIn, ROUTES, withParam } from "./links";

describe("home links", () => {
  it("defines standard route paths", () => {
    expect(ROUTES.snap).toBe("/?flow=1");
    expect(ROUTES.demo).toBe("/?flow=1&golden=note1");
    expect(ROUTES.ohmsLaw).toBe("/?learn=ohms-law");
    expect(ROUTES.practical).toBe("/?practical=ohms-law");
  });

  it("opens the V–I practical in each mode", () => {
    expect(practicalIn("watch")).toBe("/?practical=ohms-law&mode=watch");
    expect(practicalIn("practice")).toBe("/?practical=ohms-law&mode=practice");
    expect(practicalIn("exam")).toBe("/?practical=ohms-law&mode=exam");
  });

  it("adds a query param to an existing query string", () => {
    expect(withParam("/?flow=1", "teacher", "1")).toBe("/?flow=1&teacher=1");
  });

  it("replaces a query param while preserving others", () => {
    expect(withParam("/?flow=1&golden=note1", "golden", "g2")).toBe("/?flow=1&golden=g2");
  });

  it("adds a query param to a root path", () => {
    expect(withParam("/", "home", "1")).toBe("/?home=1");
  });
});
