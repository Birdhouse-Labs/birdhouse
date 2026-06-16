// ABOUTME: Full-page view for Remote Access settings
// ABOUTME: Wraps RemoteAccessSettings in a page layout consistent with WorkspaceSettings

import { useNavigate } from "@solidjs/router";
import { type Component } from "solid-js";
import { usePageTitle } from "../lib/page-title";
import Button from "./ui/Button";
import RemoteAccessSettings from "./RemoteAccessSettings";

const RemoteAccessPage: Component = () => {
  usePageTitle("Remote Access - Birdhouse");

  const navigate = useNavigate();

  return (
    <div class="h-full overflow-auto p-8">
      <div class="max-w-4xl mx-auto">
        {/* Header */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-text-primary mb-2">Remote Access</h1>
          <p class="text-text-muted">Manage devices that can access Birdhouse remotely.</p>
        </div>

        <RemoteAccessSettings />

        {/* Back Button */}
        <div class="flex justify-start mt-6">
          <Button variant="secondary" onClick={() => navigate("/")}>
            ← Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RemoteAccessPage;
