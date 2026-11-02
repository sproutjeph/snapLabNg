import { describe, expect, it } from "vitest";
import { apiUrl, wsUrl } from "./apiOrigin";

const page = { protocol: "https:", host: "snaplab.web.app" };

describe("apiUrl", () => {
  it("leaves the path alone when no origin is set", () => {
    expect(apiUrl("/api/snap", undefined)).toBe("/api/snap");
    expect(apiUrl("/api/snap", "")).toBe("/api/snap");
  });
  it("prefixes the origin and drops a trailing slash", () => {
    expect(apiUrl("/api/snap", "https://x.run.app/")).toBe("https://x.run.app/api/snap");
  });
});

describe("wsUrl", () => {
  it("uses the page host when no origin is set", () => {
    expect(wsUrl("/ws/examiner", undefined, page)).toBe("wss://snaplab.web.app/ws/examiner");
    expect(wsUrl("/ws/examiner", "", { protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/ws/examiner",
    );
  });
  it("turns the API origin into ws or wss", () => {
    expect(wsUrl("/ws/examiner", "https://x.run.app/", page)).toBe("wss://x.run.app/ws/examiner");
    expect(wsUrl("/ws/examiner", "http://localhost:8787", page)).toBe(
      "ws://localhost:8787/ws/examiner",
    );
  });
});
