import { createHash, randomUUID } from "node:crypto";
import { ExaminerTurnRequest, type SnapEvent } from "@snaplab/contracts";
import { examinerQuestionById } from "@snaplab/rules";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { StreamCache } from "./cache";
import type { Config } from "./env";
import { judgeAnswer, UnknownQuestionError } from "./examiner";
import { RateLimiter } from "./rateLimit";
import { runSnap } from "./snap";
import { EXAMINER_RESERVE_USD, SNAP_RESERVE_USD, SpendLedger } from "./spend";

const MAX_PHOTO_BYTES = 600 * 1024;
/** A whole snap gets this long before every Meta call is aborted (Wonder took 13 s on Oct 26). */
const SNAP_TIMEOUT_MS = 45_000;
/** One examiner turn is a short text-only Spark call. */
const EXAMINER_TIMEOUT_MS = 20_000;

/** The caller's IP. Proxy headers are trusted only when TRUST_PROXY=1 (e.g. behind Fly). */
function clientIp(c: Context, cfg: Config): string {
  if (cfg.trustProxy) {
    const h = c.req.header("fly-client-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0];
    if (h?.trim()) return h.trim();
  }
  // Under Bun.serve, Hono passes the server as the context's env, and Bun reports the
  // socket's address. (hono/bun's getConnInfo needs the Bun global, which tests lack.)
  const server = c.env as { requestIP?: (r: Request) => { address: string } | null } | undefined;
  return server?.requestIP?.(c.req.raw)?.address ?? "unknown";
}

export function createApp(
  cfg: Config,
  deps?: { ledger?: SpendLedger; limiter?: RateLimiter; examinerLimiter?: RateLimiter },
) {
  const ledger =
    deps?.ledger ?? new SpendLedger(cfg.spendLedgerPath, cfg.spendCapUsd, cfg.spendDailyCapUsd);
  const limiter = deps?.limiter ?? new RateLimiter(cfg.snapsPerHourPerIp);
  const examinerLimiter = deps?.examinerLimiter ?? new RateLimiter(cfg.examinerTurnsPerHourPerIp);
  const cache = new StreamCache();
  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true, mode: cfg.mode, spend: ledger.summary() }));

  app.post(
    "/api/snap",
    bodyLimit({
      maxSize: MAX_PHOTO_BYTES + 64 * 1024,
      onError: (c) => c.json({ error: "photo too large" }, 413),
    }),
    async (c) => {
      // Validate before opening the stream, so a bad request gets a plain 400.
      let form: Record<string, unknown>;
      try {
        form = await c.req.parseBody();
      } catch {
        return c.json({ error: "send a multipart form" }, 400);
      }
      const photo = form.photo;
      const width = Number(form.width);
      const height = Number(form.height);
      const bytes =
        photo instanceof File && photo.size > 0 && photo.size <= MAX_PHOTO_BYTES
          ? new Uint8Array(await photo.arrayBuffer())
          : null;
      // Check the JPEG signature itself: the part's declared type is not reliable across runtimes.
      const isJpeg = bytes !== null && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (!bytes || !isJpeg || !(width > 0) || !(height > 0)) {
        return c.json(
          { error: "send photo (JPEG, at most 600 KB), width and height (pixels)" },
          400,
        );
      }
      const ip = clientIp(c, cfg);

      return streamSSE(c, async (stream) => {
        const emit = (e: SnapEvent) => stream.writeSSE({ event: e.type, data: JSON.stringify(e) });
        const finish = async (
          stage: "input" | "rate_limit" | "budget",
          message: string,
        ): Promise<void> => {
          await emit({ type: "error", stage, message, fallback: "golden" });
          await emit({ type: "done", total_ms: 0 });
        };
        const abort = new AbortController();
        stream.onAbort(() => abort.abort());
        const signal = AbortSignal.any([
          abort.signal,
          c.req.raw.signal,
          AbortSignal.timeout(SNAP_TIMEOUT_MS),
        ]);

        try {
          if (!limiter.allow(ip)) {
            return await finish(
              "rate_limit",
              "Too many snaps from here this hour. Try the golden pages.",
            );
          }
          const live = cfg.mode === "live";
          // Fixtures mode replays the same recorded answers for any photo, so only live is cached.
          const sha = live ? createHash("sha256").update(bytes).digest("hex") : null;
          const cached = sha ? cache.get(sha) : undefined;
          if (sha && cached) {
            await emit({ type: "accepted", request_id: randomUUID(), image_sha256: sha });
            await emit({ type: "cache_hit", source: "memory" });
            for (const e of cached) if (e.type !== "accepted") await emit(e);
            return;
          }
          if (live && !ledger.reserve(SNAP_RESERVE_USD)) {
            return await finish("budget", "The live AI budget is used up. Try the golden pages.");
          }

          const pending: Promise<void>[] = [];
          let settled = !live;
          try {
            const result = await runSnap(
              cfg,
              { photo: bytes, width, height, hint: "meter_bridge" },
              (e) => pending.push(emit(e)),
              signal,
            );
            const failed = signal.aborted || result.events.some((e) => e.type === "error");
            if (live) {
              // A stage that failed or was cut off may still have been billed: assume the worst.
              ledger.settle(
                SNAP_RESERVE_USD,
                failed ? Math.max(result.costUsd, SNAP_RESERVE_USD) : result.costUsd,
              );
              settled = true;
            }
            if (sha && !failed) cache.set(sha, result.events);
            await Promise.all(pending);
          } finally {
            if (!settled) ledger.settle(SNAP_RESERVE_USD, SNAP_RESERVE_USD);
          }
        } catch {
          if (!stream.aborted) {
            await emit({
              type: "error",
              stage: "input",
              message: "Something went wrong reading this page.",
              fallback: "golden",
            });
            await emit({ type: "done", total_ms: 0 });
          }
        }
      });
    },
  );

  // One typed examiner turn (docs/06 §5.5). The question and its model answer come from the
  // bank in packages/rules; Spark only judges her answer. Never changes a mark.
  app.post(
    "/api/examiner",
    bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: "answer too long" }, 413) }),
    async (c) => {
      let req: ExaminerTurnRequest;
      try {
        req = ExaminerTurnRequest.parse(await c.req.json());
      } catch {
        return c.json(
          { error: "send question_id, answer (1–600 characters), language and her_mistake" },
          400,
        );
      }
      if (!examinerQuestionById(req.question_id)) {
        return c.json({ error: "unknown question" }, 400);
      }
      if (cfg.mode === "golden-only") {
        return c.json({ error: "The examiner is offline in this demo." }, 503);
      }
      if (!examinerLimiter.allow(clientIp(c, cfg))) {
        return c.json({ error: "Too many answers from here this hour. Try again later." }, 429);
      }
      const live = cfg.mode === "live";
      if (live && !ledger.reserve(EXAMINER_RESERVE_USD)) {
        return c.json({ error: "The live AI budget is used up." }, 402);
      }
      const signal = AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(EXAMINER_TIMEOUT_MS)]);
      let spent = EXAMINER_RESERVE_USD; // a failed or cut-off call may still have been billed
      try {
        const turn = await judgeAnswer(cfg, req, signal);
        spent = turn.costUsd;
        return c.json(turn.response);
      } catch (e) {
        if (e instanceof UnknownQuestionError) {
          spent = 0;
          return c.json({ error: "unknown question" }, 400);
        }
        return c.json({ error: "The examiner could not answer just now. Try again." }, 502);
      } finally {
        if (live) ledger.settle(EXAMINER_RESERVE_USD, spent);
      }
    },
  );

  return app;
}
