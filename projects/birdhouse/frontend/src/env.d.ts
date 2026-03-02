// ABOUTME: TypeScript declarations for Vite environment variables
// ABOUTME: Allows direct property access instead of bracket notation

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
