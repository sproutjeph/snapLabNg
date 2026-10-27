import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import OfflineNotice from "./pwa/OfflineNotice";
import { registerServiceWorker } from "./pwa/register";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
    <OfflineNotice />
  </StrictMode>,
);

registerServiceWorker();
