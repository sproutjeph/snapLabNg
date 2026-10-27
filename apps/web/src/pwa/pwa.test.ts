import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { routeFor } from "./routing";

const BASE = "http://localhost";

function url(path: string): URL {
  return new URL(path, BASE);
}

describe("routeFor", () => {
  it("serves hashed Vite assets cache-first", () => {
    expect(routeFor(url("/assets/index-abc.js"), "GET")).toBe("cache-first");
  });

  it("serves golden files cache-first", () => {
    expect(routeFor(url("/golden/note1.json"), "GET")).toBe("cache-first");
  });

  it("never handles /api/*, whatever the method", () => {
    expect(routeFor(url("/api/snap"), "POST")).toBe("bypass");
    expect(routeFor(url("/api/examiner"), "GET")).toBe("bypass");
  });

  it("loads navigations network-first", () => {
    expect(routeFor(url("/?flow=1"), "GET", "navigate")).toBe("navigate-network-first");
  });

  it("never handles other origins", () => {
    expect(routeFor(new URL("https://cdn.example.com/x.js"), "GET")).toBe("bypass");
  });

  it("never handles non-GET requests", () => {
    expect(routeFor(url("/assets/index-abc.js"), "POST")).toBe("bypass");
    expect(routeFor(url("/golden/note1.json"), "DELETE")).toBe("bypass");
    expect(routeFor(url("/?flow=1"), "POST", "navigate")).toBe("bypass");
  });
});

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

interface Manifest {
  name: string;
  short_name?: string;
  start_url: string;
  display: string;
  background_color?: string;
  theme_color?: string;
  icons: ManifestIcon[];
}

const PUBLIC_DIR = new URL("../../public/", import.meta.url);

function readManifest(): Manifest {
  const raw = readFileSync(new URL("manifest.webmanifest", PUBLIC_DIR), "utf8");
  return JSON.parse(raw) as Manifest;
}

describe("manifest.webmanifest", () => {
  it("is installable: name, start_url and standalone display", () => {
    const manifest = readManifest();
    expect(manifest.name).toBe("SnapLab NG");
    expect(manifest.start_url).toBe("/?home=1");
    expect(manifest.display).toBe("standalone");
  });

  it("has 192 and 512 icons, one of them maskable", () => {
    const manifest = readManifest();
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((icon) => icon.purpose?.includes("maskable"))).toBe(true);
  });

  it("points at icon files that exist", () => {
    const manifest = readManifest();
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const file = new URL(`.${icon.src}`, PUBLIC_DIR);
      expect(existsSync(file), icon.src).toBe(true);
    }
  });
});
