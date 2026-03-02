// ABOUTME: Pattern Library UI Experiment 2 - Group-first approach with workspace sections
// ABOUTME: Production-ready structure with collapsible sections, nested modals, and full CRUD

import { LibraryBig } from "lucide-solid";
import type { Component } from "solid-js";
import { Button } from "../../components/ui";
import { useModalRoute, useWorkspaceId } from "../../lib/routing";
import PatternLibraryDialog from "./components/PatternLibraryDialog";

export const metadata = {
  id: "02",
  title: "Group-First Pattern Library (Production Structure)",
  description:
    "Patterns organized into groups and sections (user, workspace, bundled). Features collapsible sections, nested modals for view/edit, and full CRUD operations. Structured for production deployment.",
  date: "2025-02-23",
};

const Experiment02: Component = () => {
  const workspaceId = useWorkspaceId();
  const { openModal } = useModalRoute();

  const handleOpenLibrary = () => {
    openModal("pattern-library-v2", "main");
  };

  return (
    <div class="space-y-4">
      {/* Demo Controls */}
      <div class="flex gap-4 items-center">
        <Button variant="primary" onClick={handleOpenLibrary}>
          <span class="flex items-center gap-2 whitespace-nowrap">
            <LibraryBig size={16} />
            Pattern Library
          </span>
        </Button>
      </div>

      {/* Pattern Library Dialog */}
      <PatternLibraryDialog workspaceId={workspaceId() || ""} />
    </div>
  );
};

export default Experiment02;
