import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Present inside Telegram (opened via a web_app inline-keyboard button);
// undefined when loaded as a plain website, so this is safely a no-op there.
const tg = (window as unknown as {
  Telegram?: { WebApp?: { ready: () => void; expand: () => void; requestFullscreen?: () => void } };
}).Telegram?.WebApp;
tg?.ready();
tg?.expand();
// True edge-to-edge fullscreen (Bot API 8.0+) — older Telegram clients just
// don't have the method, so feature-detect rather than version-check.
try { tg?.requestFullscreen?.(); } catch { /* unsupported client, expand() above already applied */ }

createRoot(document.getElementById("root")!).render(<App />);
