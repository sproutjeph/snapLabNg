// Bun-only wiring for GET /ws/examiner (the relay logic is in voice.ts and tested there).

import { VoiceClientEnd } from "@snaplab/contracts";
import type { Server, ServerWebSocket } from "bun";
import type { Config } from "./env";
import type { RateLimiter } from "./rateLimit";
import type { SpendLedger } from "./spend";
import { startVoiceSession, type Upstream, type VoiceSession } from "./voice";

export const VOICE_PATH = "/ws/examiner";

interface SocketData {
  session: VoiceSession | null;
}

function openUpstream(url: string): Upstream {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  const up: Upstream = {
    send: (d) => ws.send(d),
    close: () => ws.close(),
    onopen: null,
    onmessage: null,
    onclose: null,
  };
  ws.onopen = () => up.onopen?.();
  ws.onmessage = (e) => {
    if (typeof e.data === "string") up.onmessage?.(e.data);
  };
  ws.onclose = () => up.onclose?.();
  ws.onerror = () => {}; // a close always follows
  return up;
}

function clientIp(req: Request, server: Server<SocketData>, cfg: Config): string {
  if (cfg.trustProxy) {
    // The last entry is the one Google's front end appended (the first can be forged).
    const h = req.headers.get("x-forwarded-for")?.split(",").at(-1);
    if (h?.trim()) return h.trim();
  }
  return server.requestIP(req)?.address ?? "unknown";
}

/**
 * Whether a WebSocket upgrade may proceed. With no ALLOWED_ORIGINS, anything (today's behaviour).
 * Otherwise the Origin must be listed or share the request's own host.
 */
export function wsOriginAllowed(req: Request, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (allowed.includes(origin.replace(/\/+$/, ""))) return true;
  try {
    return new URL(origin).host === (req.headers.get("host") ?? new URL(req.url).host);
  } catch {
    return false;
  }
}

/**
 * Upgrades /ws/examiner requests (one socket per spoken answer). Returns a Response when the
 * request is refused, `undefined` once upgraded, or null for any other path.
 */
export function voiceUpgrade(
  req: Request,
  server: Server<SocketData>,
  cfg: Config,
  limiter: RateLimiter,
): Response | undefined | null {
  if (new URL(req.url).pathname !== VOICE_PATH) return null;
  if (!wsOriginAllowed(req, cfg.allowedOrigins)) {
    return new Response("Origin not allowed.", { status: 403 });
  }
  if (!limiter.allow(clientIp(req, server, cfg))) {
    return new Response("Too many answers from here this hour.", { status: 429 });
  }
  if (server.upgrade(req, { data: { session: null } })) return undefined;
  return new Response("Expected a WebSocket.", { status: 400 });
}

export function voiceWebSocket(cfg: Config, ledger: SpendLedger) {
  return {
    open(ws: ServerWebSocket<SocketData>) {
      ws.data.session = startVoiceSession(
        cfg,
        { ledger, openUpstream },
        { send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() },
      );
    },
    message(ws: ServerWebSocket<SocketData>, msg: string | Buffer) {
      const s = ws.data.session;
      if (!s) return;
      if (typeof msg === "string") {
        try {
          if (VoiceClientEnd.safeParse(JSON.parse(msg)).success) s.onClientEnd();
        } catch {}
        return;
      }
      s.onClientAudio(new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength));
    },
    close(ws: ServerWebSocket<SocketData>) {
      ws.data.session?.onClientClose();
    },
    // A spoken answer is at most 60 s; frames are 100 ms (3.2 kB).
    maxPayloadLength: 64 * 1024,
  };
}
