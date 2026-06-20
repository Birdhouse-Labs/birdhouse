import tailwindcss from "@tailwindcss/vite";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const allowedHosts = process.env.BIRDHOUSE_ALLOWED_HOSTS
  ? process.env.BIRDHOUSE_ALLOWED_HOSTS.split(",").map((h) => h.trim())
  : undefined;

export default defineConfig(({ command }) => ({
  plugins: [devtools(), solidPlugin(), tailwindcss()],
  clearScreen: false, // Don't clear terminal on startup
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 50120,
    host: "0.0.0.0", // Listen on all network interfaces for external access
    allowedHosts,
    strictPort: true, // Fail if port is in use instead of trying others
    // Proxy PostHog ingest to backend so requests go through our server,
    // avoiding adblockers in both dev and production.
    proxy: command === "serve" ? {
      "/ingest": {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || "50121"}`,
        changeOrigin: true,
      },
    } : undefined,
  },
  preview: {
    port: process.env.PORT ? Number(process.env.PORT) : 50120,
    host: "0.0.0.0", // Listen on all network interfaces for external access
    allowedHosts,
    strictPort: true, // Fail if port is in use instead of trying others
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libs for better caching
          "vendor-ui": ["solid-js", "@solidjs/router"],
          "vendor-syntax": ["shiki", "marked"],
        },
      },
    },
  },
}));
