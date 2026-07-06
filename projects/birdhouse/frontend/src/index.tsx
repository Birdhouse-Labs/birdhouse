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
import { exchangeLaunchToken } from "./lib/launch-token";
import { initPosthog } from "./lib/posthog";

const root = document.getElementById("root");

initPosthog();

// Exchange the launch token (if present) before any API calls are made.
// This sets the session cookie that all subsequent requests depend on.
// Must complete before render so no API call fires without the cookie.
await exchangeLaunchToken();

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
