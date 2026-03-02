// ABOUTME: Pure syntax highlighting component - renders code only
// ABOUTME: Returns highlighted HTML - parent provides container/border/styling

import { codeToHtml } from "shiki";
import { type Component, createMemo, createResource } from "solid-js";
import { uiSize } from "../../theme";

export interface CodeBlockProps {
  code: string;
  language: string;
  theme: string;
  highlightingEnabled?: boolean;
}

export const CodeBlock: Component<CodeBlockProps> = (props) => {
  const sizeClasses = () => {
    const size = uiSize();
    return {
      code: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
    };
  };

  // If highlighting disabled, show plain text
  const highlightingEnabled = () => props.highlightingEnabled ?? true;

  const sourceKey = createMemo(() => ({
    code: props.code,
    lang: props.language,
    theme: props.theme,
  }));

  const [highlightedCode] = createResource(
    () => (highlightingEnabled() ? sourceKey() : null),
    async (key) => {
      if (!key) return null;

      const { code, lang, theme } = key;
      const codeString = String(code ?? "");

      try {
        return await codeToHtml(codeString, {
          lang,
          theme,
        });
      } catch (_error) {
        return await codeToHtml(codeString, {
          lang: "text",
          theme,
        });
      }
    },
    { deferStream: true },
  );

  return (
    <div class="relative">
      {highlightingEnabled() && highlightedCode() ? (
        <div
          class="syntax-highlight"
          classList={{
            [sizeClasses().code]: true,
          }}
          innerHTML={highlightedCode() ?? ""}
        />
      ) : (
        <pre
          class="font-mono whitespace-pre-wrap p-3 text-text-primary"
          classList={{
            [sizeClasses().code]: true,
          }}
        >
          {props.code}
        </pre>
      )}
    </div>
  );
};

export default CodeBlock;
