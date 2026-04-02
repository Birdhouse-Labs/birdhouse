// ABOUTME: Smoke tests for the workspace configuration dialog shell.
// ABOUTME: Verifies the dialog opens, hides when closed, and keeps the primary actions available with mocked children.

import { render, screen } from "@solidjs/testing-library";
import { createContext, type JSX, useContext } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkspace, restartWorkspace } from "../../services/workspaces-api";
import type { Workspace } from "../../types/workspace";
import { fetchWorkspaceConfig, updateWorkspaceConfig } from "../services/workspace-config-api";
import type { WorkspaceConfig } from "../types/config-types";
import WorkspaceConfigDialog from "./WorkspaceConfigDialog";

vi.mock("../../services/workspaces-api", () => ({
  fetchWorkspace: vi.fn(),
  restartWorkspace: vi.fn(),
}));

vi.mock("../services/workspace-config-api", () => ({
  fetchWorkspaceConfig: vi.fn(),
  updateWorkspaceConfig: vi.fn(),
}));

const DialogContext = createContext<{ onOpenChange?: (open: boolean) => void } | undefined>(undefined);

vi.mock("corvu/dialog", () => ({
  default: Object.assign(
    (props: { open?: boolean; onOpenChange?: (open: boolean) => void; children: JSX.Element }) =>
      props.open === false ? null : (
        <DialogContext.Provider value={props.onOpenChange ? { onOpenChange: props.onOpenChange } : {}}>
          {props.children}
        </DialogContext.Provider>
      ),
    {
      Portal: (props: { children: JSX.Element }) => <>{props.children}</>,
      Overlay: () => null,
      Content: (props: { children: JSX.Element; class?: string }) => <div class={props.class}>{props.children}</div>,
      Label: (props: { children: JSX.Element; class?: string }) => <h2 class={props.class}>{props.children}</h2>,
      Close: (props: { children: JSX.Element; class?: string }) => {
        const context = useContext(DialogContext);
        return (
          <button type="button" class={props.class} onClick={() => context?.onOpenChange?.(false)}>
            {props.children}
          </button>
        );
      },
    },
  ),
}));

vi.mock("../../components/LogViewer", () => ({ default: () => <div>Log Viewer</div> }));
vi.mock("./WorkspaceTitleSection", () => ({ default: () => <div>Workspace Title Section</div> }));
vi.mock("./ProvidersList", () => ({ default: () => <div>Providers List</div> }));
vi.mock("./McpConfigSection", () => ({ default: () => <div>MCP Config Section</div> }));
vi.mock("./EnvVarsSection", () => ({ default: () => <div>Env Vars Section</div> }));
vi.mock("./ProviderDialog", () => ({ default: () => <div>Provider</div> }));
vi.mock("./ProviderDeleteDialog", () => ({ default: () => <div>Delete Provider</div> }));
vi.mock("./McpJsonDialog", () => ({ default: () => null }));
vi.mock("./UnsavedChangesDialog", () => ({ default: () => null }));

describe("WorkspaceConfigDialog", () => {
  const mockWorkspace: Workspace = {
    workspace_id: "test-workspace-id",
    title: "Test Workspace",
    directory: "/path/to/test-workspace",
    created_at: 1704067200000,
    last_used: 1704067200000,
  };

  const mockConfig: WorkspaceConfig = {
    providers: new Map([["anthropic", "sk-ant-test-123"]]),
    anthropicOptions: { extended_context: false },
    mcpServers: {},
    envVars: new Map(),
  };

  const props = {
    open: true,
    onOpenChange: vi.fn(),
    workspaceId: "test-workspace-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchWorkspace).mockResolvedValue(mockWorkspace);
    vi.mocked(fetchWorkspaceConfig).mockResolvedValue(mockConfig);
    vi.mocked(updateWorkspaceConfig).mockResolvedValue(undefined);
    vi.mocked(restartWorkspace).mockResolvedValue({ success: true });
  });

  it("renders the dialog shell when open", () => {
    render(() => <WorkspaceConfigDialog {...props} />);

    expect(screen.getByRole("heading", { name: "Edit Workspace Configuration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & Restart" })).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(() => <WorkspaceConfigDialog {...props} open={false} />);

    expect(screen.queryByRole("heading", { name: "Edit Workspace Configuration" })).not.toBeInTheDocument();
  });

  it("starts fetching workspace and config data when opened", () => {
    render(() => <WorkspaceConfigDialog {...props} />);

    expect(fetchWorkspace).toHaveBeenCalledWith("test-workspace-id");
    expect(fetchWorkspaceConfig).toHaveBeenCalledWith("test-workspace-id");
  });
});
