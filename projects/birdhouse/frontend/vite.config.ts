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
    // Proxy API and ingest routes to the backend server.
    // In dev, frontend (50120) and server (50121) are separate processes.
    // Proxying /api, /aapi, and /ingest through the frontend port means only
    // one port needs to be exposed for remote access.
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || "50121"}`,
        changeOrigin: true,
      },
      "/aapi": {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || "50121"}`,
        changeOrigin: true,
      },
      "/ingest": {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || "50121"}`,
        changeOrigin: true,
      },
    },
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
