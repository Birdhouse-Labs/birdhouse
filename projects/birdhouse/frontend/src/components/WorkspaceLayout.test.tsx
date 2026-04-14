// ABOUTME: Tests global workspace keyboard shortcuts wired through tinykeys.
// ABOUTME: Verifies the agent search shortcut opens the dialog from WorkspaceLayout.

import { render, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openModalMock, setIsCommandPaletteOpenMock, tinykeysMock } = vi.hoisted(() => ({
  openModalMock: vi.fn(),
  setIsCommandPaletteOpenMock: vi.fn(),
  tinykeysMock: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  Navigate: (props: { href: string }) => <div data-testid="navigate">{props.href}</div>,
  useMatch: () => () => false,
}));

vi.mock("tinykeys", () => ({
  tinykeys: tinykeysMock,
}));

vi.mock("../contexts/SkillCacheContext", () => ({
  SkillCacheProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

vi.mock("../contexts/StreamingContext", () => ({
  StreamingProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
  useStreaming: () => ({
    subscribeToWorkspaceRestarting: () => () => {},
  }),
}));

vi.mock("../contexts/WorkspaceContext", () => ({
  WorkspaceProvider: (props: { children: JSX.Element }) => <>{props.children}</>,
}));

vi.mock("../LiveApp", () => ({
  default: () => <div>Live App</div>,
}));

vi.mock("../lib/command-palette-state", () => ({
  setIsCommandPaletteOpen: setIsCommandPaletteOpenMock,
}));

vi.mock("../lib/preferences", () => ({
  commandPaletteShortcut: () => "$mod+k",
}));

vi.mock("../lib/routing", () => ({
  useModalRoute: () => ({
    currentModal: () => null,
    isModalOpen: () => false,
    closeModal: vi.fn(),
    openModal: openModalMock,
  }),
  useWorkspaceId: () => () => "ws-test",
}));

vi.mock("../services/workspaces-api", () => ({
  fetchWorkspace: vi.fn(async () => ({ title: "Workspace" })),
  fetchWorkspaceHealth: vi.fn(async () => ({ harnessRunning: true, configError: null })),
  startWorkspace: vi.fn(async () => undefined),
}));

vi.mock("../theme/createMediaQuery", () => ({
  createMediaQuery: () => () => true,
}));

vi.mock("../workspace-config/components/WorkspaceConfigDialog", () => ({
  default: () => null,
}));

vi.mock("./Header", () => ({
  default: () => <div>Header</div>,
}));

vi.mock("./WorkspaceBooting", () => ({
  default: () => <div>Booting</div>,
}));

vi.mock("./WorkspaceSettings", () => ({
  default: () => <div>Settings</div>,
}));

vi.mock("../Playground", () => ({
  default: () => <div>Playground</div>,
}));

import WorkspaceLayout from "./WorkspaceLayout";

describe("WorkspaceLayout keyboard shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tinykeysMock.mockReturnValue(() => {});
  });

  it("opens agent search when $mod+o is pressed", async () => {
    render(() => <WorkspaceLayout />);

    await waitFor(() => {
      expect(tinykeysMock).toHaveBeenCalled();
    });

    const bindings = tinykeysMock.mock.calls[0]?.[1] as Record<string, (event: KeyboardEvent) => void>;
    const handler = bindings?.["$mod+o"];

    expect(handler).toBeTypeOf("function");

    const preventDefault = vi.fn();
    handler?.({ preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(openModalMock).toHaveBeenCalledWith("agent-search", "main");
  });
});
