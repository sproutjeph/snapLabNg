import { createApp } from "./app";
import { loadConfig } from "./env";

const cfg = loadConfig();
const app = createApp(cfg);
console.log(`snaplab api on :${cfg.port} (mode ${cfg.mode})`);

export default {
  port: cfg.port,
  fetch: app.fetch,
  // Bun closes a connection after 10 s without bytes by default; a snap stream can be
  // quiet for longer while Wonder thinks (13 s on Oct 26). 255 s is Bun's maximum.
  idleTimeout: 255,
};
