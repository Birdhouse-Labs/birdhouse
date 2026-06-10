// ABOUTME: Tests Monaco editor integration details that matter for read-only file viewing.
// ABOUTME: Verifies async editor setup still reveals a requested line after the editor becomes ready.

import { render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TextEditor from "./TextEditor";

const editorMocks = vi.hoisted(() => {
  const setPosition = vi.fn();
  const revealLineInCenter = vi.fn();
  const dispose = vi.fn();
  const modelDispose = vi.fn();

  return {
    setPosition,
    revealLineInCenter,
    dispose,
    modelDispose,
    create: vi.fn(() => ({
      getModel: () => ({
        getLineCount: () => 120,
        onDidChangeContent: vi.fn(),
        dispose: modelDispose,
      }),
      getValue: () => "",
      setValue: vi.fn(),
      updateOptions: vi.fn(),
      onDidFocusEditorText: vi.fn(),
      onDidBlurEditorText: vi.fn(),
      setPosition,
      revealLineInCenter,
      dispose,
    })),
  };
});

vi.mock("../../theme", () => ({
  resolvedCodeTheme: () => "github-dark",
}));

vi.mock("./text-editor/monacoSetup", () => ({
  loadMonaco: vi.fn(async () => ({
    editor: {
      create: editorMocks.create,
      setTheme: vi.fn(),
      setModelLanguage: vi.fn(),
    },
  })),
}));

describe("TextEditor", () => {
  beforeEach(() => {
    editorMocks.create.mockClear();
    editorMocks.setPosition.mockClear();
    editorMocks.revealLineInCenter.mockClear();
    editorMocks.dispose.mockClear();
    editorMocks.modelDispose.mockClear();
  });

  it("reveals the requested line after the Monaco editor becomes ready", async () => {
    render(() => <TextEditor value="line 1\nline 2" onInput={() => {}} language="markdown" revealLineNumber={42} />);

    await waitFor(() => {
      expect(editorMocks.setPosition).toHaveBeenCalledWith({ lineNumber: 42, column: 1 });
      expect(editorMocks.revealLineInCenter).toHaveBeenCalledWith(42);
    });
  });
});
