import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Present inside Telegram (opened via a web_app inline-keyboard button);
// undefined when loaded as a plain website, so this is safely a no-op there.
const tg = (window as unknown as { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } }).Telegram?.WebApp;
tg?.ready();
tg?.expand();

createRoot(document.getElementById("root")!).render(<App />);
