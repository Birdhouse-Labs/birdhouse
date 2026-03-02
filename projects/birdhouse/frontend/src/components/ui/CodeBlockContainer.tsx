// ABOUTME: Container component that wraps CodeBlock with frame, header, and styling
// ABOUTME: Provides consistent bordered presentation with language label, optional title, copy button, and optional footer

import { Check, Copy } from "lucide-solid";
import type { JSX } from "solid-js";
import { type Component, createSignal, Show } from "solid-js";
import { borderColor, cardSurface } from "../../styles/containerStyles";
import { uiSize } from "../../theme";
import { CodeBlock } from "./CodeBlock";

export interface CodeBlockContainerProps {
  code: string;
  language: string;
  theme: string;
  title?: string;
  displayName?: string;
  showCopyButton?: boolean;
  footer?: JSX.Element;
  highlightingEnabled?: boolean;
}

export const CodeBlockContainer: Component<CodeBlockContainerProps> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const fallbackCopyTextToClipboard = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;

    // Critical iOS requirements for execCommand to work
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.fontSize = "16px"; // Prevent iOS auto-zoom
    textarea.readOnly = true; // Prevent iOS keyboard popup

    document.body.appendChild(textarea);

    // CRITICAL: Focus before selection (required for iOS)
    textarea.focus();

    // iOS-specific selection handling
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);

    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, 999999);
    } else {
      textarea.select();
    }

    const successful = document.execCommand("copy");

    document.body.removeChild(textarea);

    if (!successful) {
      throw new Error('execCommand("copy") failed');
    }
  };

  const handleCopy = async () => {
    try {
      // Attempt modern Clipboard API first
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for iOS Safari, older browsers, and permission failures
      // biome-ignore lint/suspicious/noConsole: Useful for debugging clipboard issues
      console.warn("Clipboard API failed, using fallback:", error);
      try {
        fallbackCopyTextToClipboard(props.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        // biome-ignore lint/suspicious/noConsole: Important error logging for clipboard failures
        console.error("All copy methods failed:", fallbackError);
      }
    }
  };

  const sizeClasses = () => {
    const size = uiSize();
    return {
      header: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm",
      title: size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
      badge: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm",
    };
  };

  return (
    <div class={`rounded ${cardSurface}`}>
      {/* Header */}
      <div
        class="flex items-center justify-between px-3 bg-surface-overlay"
        classList={{
          [`border-b ${borderColor}`]: props.code?.trim().length > 0 || !!props.footer,
          "rounded-b": !props.code?.trim().length && !props.footer,
        }}
      >
        {/* Left: Language */}
        <span
          class="font-mono tracking-wider text-text-muted"
          classList={{
            [sizeClasses().header]: true,
          }}
        >
          {props.displayName ?? props.language}
        </span>

        {/* Center: Optional title */}
        <Show when={props.title}>
          <span
            class="text-text-secondary flex-1 text-center mx-4"
            classList={{
              [sizeClasses().title]: true,
            }}
          >
            {props.title}
          </span>
        </Show>

        {/* Right: Copy button */}
        <Show when={props.showCopyButton !== false}>
          <button
            type="button"
            onClick={handleCopy}
            class="px-3 py-2 rounded bg-transparent border border-transparent transition-all hover:bg-surface-raised hover:border-border"
            classList={{
              [sizeClasses().badge]: true,
            }}
            aria-label="Copy code to clipboard"
          >
            <Show
              when={!copied()}
              fallback={
                <span class="flex items-center gap-1 text-success">
                  <Check size={14} />
                  <span class="text-xs">Copied!</span>
                </span>
              }
            >
              <span class="flex items-center gap-1 text-text-muted">
                <Copy size={14} />
                <span class="text-xs">Copy</span>
              </span>
            </Show>
          </button>
        </Show>
      </div>

      {/* Code content - only render if code is not empty */}
      <Show when={props.code && props.code.trim().length > 0}>
        <div
          class="overflow-hidden"
          classList={{
            "rounded-b": !props.footer,
          }}
        >
          <CodeBlock
            code={props.code}
            language={props.language}
            theme={props.theme}
            {...(props.highlightingEnabled !== undefined && {
              highlightingEnabled: props.highlightingEnabled,
            })}
          />
        </div>
      </Show>

      {/* Footer slot */}
      <Show when={props.footer}>
        <div class={`border-t ${borderColor}`}>{props.footer}</div>
      </Show>
    </div>
  );
};

export default CodeBlockContainer;
