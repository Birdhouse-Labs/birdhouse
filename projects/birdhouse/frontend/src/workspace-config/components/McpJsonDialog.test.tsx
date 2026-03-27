// ABOUTME: Smoke tests for the MCP JSON dialog shell with a lightweight editor mock.
// ABOUTME: Verifies the dialog renders and basic save/close interactions still work after the Monaco swap.

import { fireEvent, render, screen } from "@solidjs/testing-library";
import { createContext, type JSX, useContext } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import McpJsonDialog from "./McpJsonDialog";

const DialogContext = createContext<{ onOpenChange?: (open: boolean) => void } | undefined>(undefined);

vi.mock("corvu/dialog", () => ({
  default: Object.assign(
    (props: { open?: boolean; onOpenChange?: (open: boolean) => void; children: JSX.Element }) =>
      props.open === false ? null : (
        <DialogContext.Provider value={{ onOpenChange: props.onOpenChange }}>{props.children}</DialogContext.Provider>
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

vi.mock("corvu/popover", () => ({
  default: Object.assign((props: { children: JSX.Element }) => <>{props.children}</>, {
    Trigger: (props: { children: JSX.Element; class?: string }) => (
      <button type="button" class={props.class}>
        {props.children}
      </button>
    ),
    Portal: (props: { children: JSX.Element }) => <>{props.children}</>,
    Content: (props: { children: JSX.Element; class?: string }) => <div class={props.class}>{props.children}</div>,
  }),
}));

vi.mock("../../components/ui/TextEditor", () => ({
  default: (props: { value: string; onInput: (value: string) => void; placeholder?: string }) => (
    <textarea
      aria-label="MCP server configuration JSON"
      value={props.value}
      placeholder={props.placeholder}
      onInput={(event) => props.onInput(event.currentTarget.value)}
    />
  ),
}));

describe("McpJsonDialog", () => {
  const onOpenChange = vi.fn();
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open", () => {
    render(() => <McpJsonDialog open={true} onOpenChange={onOpenChange} initialJson="" onSave={onSave} />);

    expect(screen.getByRole("heading", { name: "MCP Server Configuration" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves an empty object when blank", () => {
    render(() => <McpJsonDialog open={true} onOpenChange={onOpenChange} initialJson="" onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({});
  });

  it("closes when cancel is clicked", () => {
    render(() => <McpJsonDialog open={true} onOpenChange={onOpenChange} initialJson="" onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
