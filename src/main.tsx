import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App.tsx";

// #region agent log
fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/main.tsx:boot", message: "Boot: VITE_CONVEX_URL", data: (() => { const raw = (import.meta as any)?.env?.VITE_CONVEX_URL; let parsed: { ok: boolean; protocol?: string; host?: string } = { ok: false }; try { const u = new URL(String(raw)); parsed = { ok: true, protocol: u.protocol, host: u.host }; } catch { /* ignore */ } return { hasUrl: Boolean(raw), urlType: typeof raw, urlHost: parsed.host, urlProtocol: parsed.protocol, urlPreview: typeof raw === "string" ? raw.slice(0, 48) : String(raw), origin: typeof window !== "undefined" ? window.location.origin : "unknown" }; })(), timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "A" }) }).catch(() => {});
// #endregion

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
// #region agent log
fetch("http://127.0.0.1:7244/ingest/1e251e9c-b8aa-4e39-b968-d4efd22e542b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "src/main.tsx:convex-client", message: "ConvexReactClient constructed", data: { constructed: true }, timestamp: Date.now(), sessionId: "debug-session", runId: "pre-fix", hypothesisId: "A" }) }).catch(() => {});
// #endregion
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </StrictMode>,
);
