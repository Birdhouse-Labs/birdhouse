// ABOUTME: Main app container with workspace-aware routing
// ABOUTME: Routes to workspace selector or workspace-scoped views; guards require name setup

import { Route, type RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { type Component, createEffect, createResource, type JSX } from "solid-js";
import NotFound from "./components/NotFound";
import SetupProfile from "./components/SetupProfile";
import WorkspaceLayout from "./components/WorkspaceLayout";
import WorkspaceSelector from "./components/WorkspaceSelector";
import WorkspaceSetup from "./components/WorkspaceSetup";
import { log } from "./lib/logger";
import { identifyPosthogUser } from "./lib/posthog";
import { fetchUserProfile } from "./services/user-profile-api";

const REDIRECT_KEY = "birdhouse.setup.redirect";

/**
 * Reads user profile status and redirects to /setup/profile when name is not set.
 * Only redirects when the profile request succeeds with no name — server errors
 * (500, network failure, etc.) are ignored so a broken server doesn't redirect
 * the user away from wherever they are.
 */
const ProfileRedirect: Component<{ children: JSX.Element }> = (props) => {
  const [profile, { refetch: _refetch }] = createResource(fetchUserProfile);
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (profile.loading) return;

    const isProfilePage = location.pathname === "/setup/profile";
    const profileLoaded = !profile.error && profile() !== undefined;
    const data = profile();
    const hasName = profileLoaded && !!data?.name;

    log.ui.info("ProfileRedirect effect running", {
      hasName,
      profileLoaded,
      pathname: location.pathname,
      loading: profile.loading,
    });

    // Identify the user in PostHog whenever we have both a name and install ID
    if (hasName && data?.installId && data.name) {
      identifyPosthogUser(data.installId, data.name);
    }

    // Already on the profile page and name is now set — redirect back
    if (isProfilePage && hasName) {
      const redirect = sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate(redirect ?? "/", { replace: true });
      return;
    }

    // Not on the profile page, request succeeded, but name is missing — redirect to setup
    if (!isProfilePage && profileLoaded && !hasName) {
      const current = location.pathname + location.search;
      if (current !== "/") {
        sessionStorage.setItem(REDIRECT_KEY, current);
      }
      log.ui.info("No name set, redirecting to profile setup", { current });
      navigate("/setup/profile", { replace: true });
    }
  });

  return <>{props.children}</>;
};

/**
 * Root layout for all protected routes — enforces profile setup completion.
 */
const ProfileGuard: Component<RouteSectionProps> = (props) => <ProfileRedirect>{props.children}</ProfileRedirect>;

/**
 * Route configuration
 */
export default function App() {
  log.ui.info("App routes initialized");

  return (
    <>
      {/* Profile setup — outside the guard so it always renders */}
      <Route path="/setup/profile" component={SetupProfile} />

      {/* All other routes are protected by the profile guard */}
      <Route component={ProfileGuard}>
        <Route path="/" component={WorkspaceSelector} />
        <Route path="/setup" component={WorkspaceSetup} />
        <Route path="/workspace/:workspaceId/agents" component={WorkspaceLayout} />
        <Route path="/workspace/:workspaceId/agent/:agentId" component={WorkspaceLayout} />
        <Route path="/workspace/:workspaceId/settings" component={WorkspaceLayout} />
        <Route path="/workspace/:workspaceId/playground/:component?" component={WorkspaceLayout} />
        <Route path="*" component={NotFound} />
      </Route>
    </>
  );
}
