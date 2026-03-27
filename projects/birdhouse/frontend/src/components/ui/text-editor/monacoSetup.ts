// ABOUTME: Lazily initializes Monaco Editor with Vite worker wiring and Shiki highlighting.
// ABOUTME: Reuses Birdhouse code theme ids so editor instances match the app's syntax theme settings.

import { shikiToMonaco } from "@shikijs/monaco";
import { createHighlighter } from "shiki";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { CODE_THEME_FAMILIES } from "../../../theme/codeThemes";

type MonacoModule = typeof import("monaco-editor");
type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;
type HighlighterLanguage = Parameters<Highlighter["loadLanguage"]>[0];
type HighlighterTheme = Parameters<Highlighter["loadTheme"]>[0];

const defaultThemes = ["github-dark", "github-light"];
const themeIds = Array.from(
  new Set(
    Object.values(CODE_THEME_FAMILIES)
      .flatMap((family) => [family.dark, family.light])
      .filter((theme): theme is string => theme !== null),
  ),
);

let monacoPromise: Promise<MonacoModule> | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function ensureMonacoEnvironment() {
  const monacoGlobal = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (_workerId: string, label: string) => Worker;
    };
  };

  if (monacoGlobal.MonacoEnvironment?.getWorker) {
    return;
  }

  monacoGlobal.MonacoEnvironment = {
    getWorker: (_workerId, label) => {
      switch (label) {
        case "json":
          return new JsonWorker();
        case "css":
        case "scss":
        case "less":
          return new CssWorker();
        case "html":
        case "handlebars":
        case "razor":
          return new HtmlWorker();
        case "typescript":
        case "javascript":
          return new TsWorker();
        default:
          return new EditorWorker();
      }
    },
  };
}

function getMonaco() {
  ensureMonacoEnvironment();

  if (!monacoPromise) {
    monacoPromise = import("monaco-editor");
  }

  return monacoPromise;
}

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: themeIds.length > 0 ? themeIds : defaultThemes,
      langs: ["json"],
    });
  }

  return highlighterPromise;
}

export async function loadMonaco(language: string, theme: string) {
  const [monaco, highlighter] = await Promise.all([getMonaco(), getHighlighter()]);

  if (!monaco.languages.getLanguages().some((item) => item.id === language)) {
    monaco.languages.register({ id: language });
  }

  try {
    await highlighter.loadLanguage(language as HighlighterLanguage);
  } catch {
    // Monaco can still render using its built-in tokenization for unsupported languages.
  }

  try {
    await highlighter.loadTheme(theme as HighlighterTheme);
  } catch {
    // Themes come from our controlled set, but keep the editor usable if one fails to load.
  }

  shikiToMonaco(highlighter, monaco);

  return monaco;
}
