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
import { fetchUserProfile } from "./services/user-profile-api";

const REDIRECT_KEY = "birdhouse.setup.redirect";

/**
 * Reads user profile status and redirects to /setup/profile when name is not set.
 * Once a name is stored, this guard never redirects again.
 */
const ProfileRedirect: Component<{ children: JSX.Element }> = (props) => {
  const [profile, { refetch: _refetch }] = createResource(fetchUserProfile);
  const navigate = useNavigate();
  const location = useLocation();

  createEffect(() => {
    if (profile.loading) return;

    const isProfilePage = location.pathname === "/setup/profile";
    const hasName = !profile.error && !!profile()?.name;

    log.ui.info("ProfileRedirect effect running", { hasName, pathname: location.pathname, loading: profile.loading });

    // Already on the profile page and name is now set — redirect back
    if (isProfilePage && hasName) {
      const redirect = sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      navigate(redirect ?? "/", { replace: true });
      return;
    }

    // Not on the profile page and name is missing — redirect to it
    if (!isProfilePage && !hasName) {
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
