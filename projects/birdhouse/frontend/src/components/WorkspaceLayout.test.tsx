// ABOUTME: Tests global workspace keyboard shortcuts wired through tinykeys.
// ABOUTME: Verifies the agent search shortcut opens the dialog from WorkspaceLayout.

import { render, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openModalMock, setIsCommandPaletteOpenMock, tinykeysMock, commandPaletteShortcutMock } = vi.hoisted(() => ({
  openModalMock: vi.fn(),
  setIsCommandPaletteOpenMock: vi.fn(),
  tinykeysMock: vi.fn(),
  commandPaletteShortcutMock: vi.fn(() => "$mod+k"),
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
  commandPaletteShortcut: commandPaletteShortcutMock,
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
    commandPaletteShortcutMock.mockReturnValue("$mod+k");
  });

  it("keeps command palette and agent search bindings independent when shortcuts collide", async () => {
    commandPaletteShortcutMock.mockReturnValue("$mod+o");

    render(() => <WorkspaceLayout />);

    await waitFor(() => {
      expect(tinykeysMock).toHaveBeenCalledTimes(2);
    });

    const handlers = tinykeysMock.mock.calls
      .map(([, bindings]) => (bindings as Record<string, (event: KeyboardEvent) => void>)["$mod+o"])
      .filter((handler): handler is (event: KeyboardEvent) => void => typeof handler === "function");

    expect(handlers).toHaveLength(2);

    const preventDefault = vi.fn();
    handlers[0]?.({ preventDefault } as unknown as KeyboardEvent);
    handlers[1]?.({ preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(setIsCommandPaletteOpenMock).toHaveBeenCalledWith(true);
    expect(openModalMock).toHaveBeenCalledWith("agent-search", "main");
  });

  it("opens agent search when $mod+o is pressed", async () => {
    render(() => <WorkspaceLayout />);

    await waitFor(() => {
      expect(tinykeysMock).toHaveBeenCalled();
    });

    const handler = tinykeysMock.mock.calls
      .map(([, bindings]) => (bindings as Record<string, (event: KeyboardEvent) => void>)["$mod+o"])
      .find((candidate): candidate is (event: KeyboardEvent) => void => typeof candidate === "function");

    expect(handler).toBeTypeOf("function");

    const preventDefault = vi.fn();
    handler?.({ preventDefault } as unknown as KeyboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(openModalMock).toHaveBeenCalledWith("agent-search", "main");
  });
});
