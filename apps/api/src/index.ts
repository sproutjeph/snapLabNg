import type { Server } from "bun";
import { createApp } from "./app";
import { loadConfig } from "./env";
import { RateLimiter } from "./rateLimit";
import { SpendLedger } from "./spend";
import { mountWebDist } from "./static";
import { voiceUpgrade, voiceWebSocket } from "./voiceServer";

const cfg = loadConfig();
// One ledger and one examiner limit for typed and spoken answers alike.
const ledger = new SpendLedger(cfg.spendLedgerPath, cfg.spendCapUsd, cfg.spendDailyCapUsd);
const examinerLimiter = new RateLimiter(cfg.examinerTurnsPerHourPerIp);
const app = createApp(cfg, { ledger, examinerLimiter });
// After every API route: the site and the API share one origin (docs/plans/deploy-fly.md).
mountWebDist(app, cfg.webDistDir);
console.log(`snaplab api on :${cfg.port} (mode ${cfg.mode})`);

export default {
  port: cfg.port,
  fetch(req: Request, server: Server<{ session: null }>) {
    const voice = voiceUpgrade(req, server, cfg, examinerLimiter);
    if (voice !== null) return voice;
    return app.fetch(req, server);
  },
  websocket: voiceWebSocket(cfg, ledger),
  // Bun closes a connection after 10 s without bytes by default; a snap stream can be
  // quiet for longer while Wonder thinks (13 s on Oct 26). 255 s is Bun's maximum.
  idleTimeout: 255,
};
