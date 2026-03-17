// ABOUTME: Copies PostHog vendor files from node_modules into public/vendor/
// ABOUTME: Run this after upgrading posthog-js to keep vendored recorder in sync

import { copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "node_modules", "posthog-js", "dist");
const dest = join(root, "public", "vendor");

mkdirSync(dest, { recursive: true });

const files = ["posthog-recorder.js", "posthog-recorder.js.map"];

for (const file of files) {
  copyFileSync(join(src, file), join(dest, file));
  console.log(`Copied ${file} -> public/vendor/${file}`);
}

console.log("PostHog vendor files updated.");
