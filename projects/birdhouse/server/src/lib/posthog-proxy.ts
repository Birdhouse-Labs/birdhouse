// ABOUTME: Provides PostHog ingest proxy for server-side forwarding
// ABOUTME: Wraps fetch calls to PostHog ingestion endpoint

export interface PosthogProxyRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
}

export interface PosthogProxy {
  proxyIngest: (request: PosthogProxyRequest) => Promise<Response>;
}

const DEFAULT_POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

export function createLivePosthogProxy(ingestHost = DEFAULT_POSTHOG_INGEST_HOST): PosthogProxy {
  return {
    proxyIngest: async ({ path, method, headers, body }) => {
      const url = `${ingestHost}${path}`;
      return fetch(url, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
      });
    },
  };
}

export function createTestPosthogProxy(): PosthogProxy {
  return {
    proxyIngest: async () => new Response(null, { status: 204 }),
  };
}
