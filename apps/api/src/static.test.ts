import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { mountWebDist, type StaticFileReader } from "./static";

const INDEX = "<!doctype html><title>SnapLab NG</title>";
const APP_JS = "console.log('snaplab');";
const SW = "self.addEventListener('fetch', () => {});";
const GOLDEN = JSON.stringify({ id: "note1" });

function makeDist(): string {
  const dir = mkdtempSync(join(tmpdir(), "dist-"));
  writeFileSync(join(dir, "index.html"), INDEX);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "app-abc.js"), APP_JS);
  writeFileSync(join(dir, "sw.js"), SW);
  writeFileSync(join(dir, "manifest.webmanifest"), "{}");
  mkdirSync(join(dir, "golden"));
  writeFileSync(join(dir, "golden", "note1.json"), GOLDEN);
  return dir;
}

const fsReader: StaticFileReader = async (p) => {
  try {
    return new Uint8Array(await readFile(p));
  } catch {
    return null;
  }
};

function makeApp() {
  const app = new Hono();
  app.get("/healthz", (c) => c.json({ ok: true }));
  mountWebDist(app, makeDist(), fsReader);
  return app;
}

describe("mountWebDist", () => {
  it("GET / gives index.html with no-cache", async () => {
    const res = await makeApp().request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX);
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("GET /?flow=1 gives index.html", async () => {
    const res = await makeApp().request("/?flow=1");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX);
  });

  it("GET /assets/app-abc.js gives the file with the immutable header", async () => {
    const res = await makeApp().request("/assets/app-abc.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(APP_JS);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /sw.js gives no-cache", async () => {
    const res = await makeApp().request("/sw.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SW);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("GET /manifest.webmanifest gives no-cache", async () => {
    const res = await makeApp().request("/manifest.webmanifest");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("GET /golden/note1.json gives the file", async () => {
    const res = await makeApp().request("/golden/note1.json");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(GOLDEN);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /missing.js gives 404 and GET /some/route gives index.html", async () => {
    const app = makeApp();
    const missing = await app.request("/missing.js");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-content-type-options")).toBe("nosniff");
    const route = await app.request("/some/route");
    expect(route.status).toBe(200);
    expect(await route.text()).toBe(INDEX);
    expect(route.headers.get("cache-control")).toBe("no-cache");
  });

  it("GET /api/nope is not served by static", async () => {
    const res = await makeApp().request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).not.toBe(INDEX);
  });

  it("GET /healthz is not served by static", async () => {
    const res = await makeApp().request("/healthz");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"ok":true');
  });

  it("GET /../package.json and GET /%2e%2e/package.json give 404", async () => {
    const app = makeApp();
    expect((await app.request("/../package.json")).status).toBe(404);
    expect((await app.request("/%2e%2e/package.json")).status).toBe(404);
    expect((await app.request("/%2e%2e%2fpackage.json")).status).toBe(404);
  });

  it("POST / is not served by static", async () => {
    const res = await makeApp().request("/", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("HEAD / gives headers and no body", async () => {
    const res = await makeApp().request("/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("content-length")).toBe(
      String(new TextEncoder().encode(INDEX).byteLength),
    );
  });
});
