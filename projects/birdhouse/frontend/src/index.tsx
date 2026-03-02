/* @refresh reload */
import "./index.css";
import { HashRouter } from "@solidjs/router";
import { render } from "solid-js/web";

// Only load devtools in development mode
if (import.meta.env.DEV) {
  await import("solid-devtools");
}

import App from "./App";
import { ConfigProvider } from "./contexts/ConfigContext";
import { ZIndexProvider } from "./contexts/ZIndexContext";
import { initPosthog } from "./lib/posthog";

const root = document.getElementById("root");

initPosthog();

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

if (root) {
  render(
    () => (
      <ConfigProvider>
        <ZIndexProvider baseZIndex={50}>
          <HashRouter>
            <App />
          </HashRouter>
        </ZIndexProvider>
      </ConfigProvider>
    ),
    root,
  );
}
