// ABOUTME: 404 page for unmatched routes
// ABOUTME: Displays helpful message and links back to workspace selector

import { useLocation } from "@solidjs/router";
import type { Component } from "solid-js";
import { Button } from "./ui";

const NotFound: Component = () => {
  const location = useLocation();

  return (
    <div
      class="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-bg-from via-bg-via to-bg-to text-text-primary"
      style={{
        "padding-top": "var(--safe-top)",
        "padding-bottom": "var(--safe-bottom)",
        "padding-left": "var(--safe-left)",
        "padding-right": "var(--safe-right)",
      }}
    >
      <div class="max-w-md text-center space-y-6 p-8">
        <h1 class="text-6xl font-bold text-heading">404</h1>
        <h2 class="text-2xl font-semibold text-text-primary">Page Not Found</h2>
        <p class="text-text-secondary">
          The page{" "}
          <code class="px-2 py-1 bg-surface-inset rounded text-accent font-mono text-sm">{location.pathname}</code>{" "}
          doesn't exist.
        </p>
        <div class="pt-4 flex justify-center">
          <Button variant="primary" href="/#/">
            Return Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
