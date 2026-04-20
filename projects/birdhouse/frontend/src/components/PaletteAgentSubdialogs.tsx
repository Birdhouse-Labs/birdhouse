// ABOUTME: Renders command palette agent-scoped dialogs against a snapped target agent.
// ABOUTME: Keeps notes, title, archive, and unarchive dialogs bound to the agent they were opened for.

import { type Component, Show } from "solid-js";
import AgentNotesDialog from "./AgentNotesDialog";
import ArchiveAgentDialog from "./ArchiveAgentDialog";
import EditAgentDialog from "./EditAgentDialog";
import UnarchiveAgentDialog from "./UnarchiveAgentDialog";

export type PaletteAgentDialogRequest =
  | { kind: "edit-title"; agentId: string; currentTitle: string }
  | { kind: "notes"; agentId: string }
  | { kind: "archive"; agentId: string }
  | { kind: "unarchive"; agentId: string };

interface PaletteAgentSubdialogsProps {
  request: PaletteAgentDialogRequest | null;
  workspaceId: string;
  onRequestChange: (request: PaletteAgentDialogRequest | null) => void;
}

const PaletteAgentSubdialogs: Component<PaletteAgentSubdialogsProps> = (props) => {
  return (
    <Show when={props.request} keyed>
      {(request) => (
        <>
          <EditAgentDialog
            agentId={request.agentId}
            currentTitle={request.kind === "edit-title" ? request.currentTitle : ""}
            open={request.kind === "edit-title"}
            onOpenChange={(open) => {
              if (!open) props.onRequestChange(null);
            }}
          />
          <AgentNotesDialog
            agentId={request.agentId}
            workspaceId={props.workspaceId}
            open={request.kind === "notes"}
            onOpenChange={(open) => {
              if (!open) props.onRequestChange(null);
            }}
          />
          <ArchiveAgentDialog
            agentId={request.agentId}
            open={request.kind === "archive"}
            onOpenChange={(open) => {
              if (!open) props.onRequestChange(null);
            }}
          />
          <UnarchiveAgentDialog
            agentId={request.agentId}
            open={request.kind === "unarchive"}
            onOpenChange={(open) => {
              if (!open) props.onRequestChange(null);
            }}
          />
        </>
      )}
    </Show>
  );
};

export default PaletteAgentSubdialogs;
