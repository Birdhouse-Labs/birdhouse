// ABOUTME: Launch token exchange on app boot
// ABOUTME: Exchanges a one-time launch token from the URL for a persistent session cookie

// Use window.location.origin so launch token exchange is same-origin —
// Vite proxies /api/auth/* in dev, and in production frontend and API share one port.
const AUTH_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

/**
 * Checks for a ?launch_token= query parameter, POSTs it to the server to
 * exchange for a session cookie, then removes it from the URL.
 *
 * This runs before the app renders to ensure the session cookie is set
 * before any authenticated API calls are made.
 *
 * Failures are silent — if the exchange fails (token expired, network error),
 * the URL is still cleaned up and the app continues. The user will receive
 * 401 responses from the API and see an auth error state.
 */
export async function exchangeLaunchToken(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("launch_token");

  if (!token) {
    return;
  }

  // Remove launch_token from params (keep any other params)
  params.delete("launch_token");

  // Build the cleaned URL: pathname + remaining query + hash
  const remainingQuery = params.toString();
  const cleanedUrl =
    window.location.pathname + (remainingQuery ? `?${remainingQuery}` : "") + (window.location.hash || "");

  try {
    const res =     await fetch(`${AUTH_ORIGIN}/api/auth/launch-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      console.warn("[birdhouse] Launch token exchange failed:", res.status, res.statusText);
    }
  } catch (err) {
    console.warn("[birdhouse] Launch token exchange error:", err);
  } finally {
    // Always remove the launch_token from the URL regardless of outcome
    window.history.replaceState(null, "", cleanedUrl);
  }
}
