import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Hono } from "hono";

/** Reads one file, or returns null when it does not exist. Injected in tests. */
export type StaticFileReader = (absolutePath: string) => Promise<Uint8Array | null>;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function defaultReadFile(absolutePath: string): Promise<Uint8Array | null> {
  const bun = (
    globalThis as {
      Bun?: {
        file: (p: string) => { exists(): Promise<boolean>; arrayBuffer(): Promise<ArrayBuffer> };
      };
    }
  ).Bun;
  if (bun) {
    const file = bun.file(absolutePath);
    return (await file.exists()) ? new Uint8Array(await file.arrayBuffer()) : null;
  }
  try {
    return new Uint8Array(await readFile(absolutePath));
  } catch {
    return null;
  }
}

function cacheControlFor(requestPath: string, servedName: string): string | null {
  if (requestPath.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (
    servedName === "index.html" ||
    servedName === "sw.js" ||
    servedName === "manifest.webmanifest"
  ) {
    return "no-cache";
  }
  return null;
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

/**
 * Serves the built web app (`apps/web/dist`) for GET/HEAD requests outside the API.
 * Mount after all API routes. Unknown extensionless paths fall back to index.html.
 */
export function mountWebDist(
  app: Hono,
  distDir: string,
  read: StaticFileReader = defaultReadFile,
): void {
  const root = resolve(distDir);

  const handler = async (c: { req: { path: string; method: string } }): Promise<Response> => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(c.req.path);
    } catch {
      return notFound();
    }
    if (decoded.includes("\\") || decoded.split("/").includes("..")) return notFound();
    if (decoded === "/healthz" || decoded.startsWith("/api/") || decoded.startsWith("/ws/")) {
      return notFound();
    }
    if (decoded === "/api" || decoded === "/ws") return notFound();

    const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    const absolute = resolve(root, relative);
    if (absolute !== root && !absolute.startsWith(root + sep)) return notFound();

    let servedPath = absolute;
    let servedName = relative.split("/").at(-1) ?? "";
    let body = await read(servedPath);

    if (body === null) {
      if (servedName.includes(".")) return notFound();
      servedPath = resolve(root, "index.html");
      servedName = "index.html";
      body = await read(servedPath);
      if (body === null) return notFound();
    }

    const headers: Record<string, string> = {
      "Content-Type":
        CONTENT_TYPES[extname(servedName).toLowerCase()] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(body.byteLength),
    };
    const cache = cacheControlFor(decoded === "/" ? "/index.html" : decoded, servedName);
    if (cache) headers["Cache-Control"] = cache;

    if (c.req.method === "HEAD") return new Response(null, { status: 200, headers });
    const bytes = new Uint8Array(body.byteLength);
    bytes.set(body);
    return new Response(bytes.buffer, { status: 200, headers });
  };

  app.on(["GET", "HEAD"], "/*", handler);
}
