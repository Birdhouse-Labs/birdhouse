// ABOUTME: Reusable Monaco-based code editor that follows the app's Shiki code theme selection.
// ABOUTME: Lazily loads Monaco, exposes a controlled value API, and provides placeholder support for empty editors.

import "monaco-editor/min/vs/editor/editor.main.css";

import type { editor as MonacoEditor } from "monaco-editor";
import { type Component, createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { resolvedCodeTheme } from "../../theme";
import { loadMonaco } from "./text-editor/monacoSetup";

export interface TextEditorProps {
  value: string;
  onInput: (value: string) => void;
  language: string;
  onBlur?: () => void;
  disabled?: boolean;
  height?: string;
  placeholder?: string;
  ariaLabel?: string;
  class?: string;
  options?: MonacoEditor.IStandaloneEditorConstructionOptions;
}

const defaultOptions: MonacoEditor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontLigatures: true,
  glyphMargin: false,
  lineNumbers: "on",
  minimap: { enabled: false },
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: "none",
  roundedSelection: true,
  scrollBeyondLastLine: false,
  tabSize: 2,
  wordWrap: "on",
  wrappingIndent: "same",
};

const TextEditor: Component<TextEditorProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let editor: MonacoEditor.IStandaloneCodeEditor | undefined;
  let lastLanguage = props.language;
  let syncingExternalValue = false;

  const [focused, setFocused] = createSignal(false);
  const [ready, setReady] = createSignal(false);

  const createEditor = async () => {
    const monaco = await loadMonaco(props.language, resolvedCodeTheme());
    if (!containerRef) {
      return;
    }

    editor = monaco.editor.create(containerRef, {
      ...defaultOptions,
      ...props.options,
      ...(props.ariaLabel ? { ariaLabel: props.ariaLabel } : {}),
      fontFamily: "var(--font-prose-code, var(--font-prose-code-default)), ui-monospace, SFMono-Regular, Menlo, monospace",
      language: props.language,
      readOnly: props.disabled ?? false,
      theme: resolvedCodeTheme(),
      value: props.value,
    });

    const model = editor.getModel();
    model?.onDidChangeContent(() => {
      if (!editor || syncingExternalValue) {
        return;
      }

      props.onInput(editor.getValue());
    });

    editor.onDidFocusEditorText(() => setFocused(true));
    editor.onDidBlurEditorText(() => {
      setFocused(false);
      props.onBlur?.();
    });

    setReady(true);
  };

  onMount(() => {
    void createEditor();
  });

  createEffect(() => {
    const nextValue = props.value;
    if (!editor || editor.getValue() === nextValue) {
      return;
    }

    syncingExternalValue = true;
    editor.setValue(nextValue);
    syncingExternalValue = false;
  });

  createEffect(() => {
    const nextTheme = resolvedCodeTheme();
    void loadMonaco(props.language, nextTheme).then((monaco) => {
      monaco.editor.setTheme(nextTheme);
    });
  });

  createEffect(() => {
    const nextDisabled = props.disabled ?? false;
    editor?.updateOptions({ readOnly: nextDisabled });
  });

  createEffect(() => {
    const nextLanguage = props.language;
    if (!editor || lastLanguage === nextLanguage) {
      return;
    }

    lastLanguage = nextLanguage;

    void loadMonaco(nextLanguage, resolvedCodeTheme()).then((monaco) => {
      const model = editor?.getModel();
      if (!editor || !model) {
        return;
      }

      monaco.editor.setModelLanguage(model, nextLanguage);
    });
  });

  onCleanup(() => {
    const model = editor?.getModel();
    editor?.dispose();
    model?.dispose();
  });

  return (
    <div
      class={`relative overflow-hidden rounded-lg border border-border bg-surface ${props.class ?? ""}`.trim()}
      style={{ height: props.height ?? "16rem" }}
    >
      <Show when={props.placeholder && !focused() && props.value.length === 0}>
        <pre class="pointer-events-none absolute inset-0 z-10 overflow-hidden p-3 text-sm text-text-muted whitespace-pre-wrap font-mono">
          {props.placeholder}
        </pre>
      </Show>
      <div class="h-full w-full" ref={containerRef} />
      <Show when={!ready()}>
        <div class="pointer-events-none absolute inset-0 bg-surface" />
      </Show>
    </div>
  );
};

export default TextEditor;
