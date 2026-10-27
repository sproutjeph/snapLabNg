import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, /api goes to the Bun server (apps/api, port 8787); `bun run dev` starts both.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
});
