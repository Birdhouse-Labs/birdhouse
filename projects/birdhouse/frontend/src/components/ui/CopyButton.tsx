// ABOUTME: Reusable copy button with clipboard fallback for iOS
// ABOUTME: Extracted from CodeBlockContainer for use across tool cards and code blocks

import { Check, Copy } from "lucide-solid";
import { type Component, createMemo, createSignal, Show, splitProps } from "solid-js";
import { uiSize } from "../../theme";

export interface CopyButtonProps {
  text: string;
  label?: string;
  class?: string;
  [key: `data-ph-capture-attribute-${string}`]: string | undefined;
}

export const CopyButton: Component<CopyButtonProps> = (allProps) => {
  const [props, dataAttrs] = splitProps(allProps, ["text", "label", "class"]);
  const [copied, setCopied] = createSignal(false);

  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      badge: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm",
    };
  });

  const fallbackCopyTextToClipboard = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;

    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.fontSize = "16px";
    textarea.readOnly = true;

    document.body.appendChild(textarea);
    textarea.focus();

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
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      try {
        fallbackCopyTextToClipboard(props.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (_fallbackError) {
        // Silent fail - could add error state if needed
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      class="px-2 py-1 rounded bg-transparent border border-transparent transition-all hover:bg-surface-raised hover:border-border"
      classList={{
        [sizeClasses().badge]: true,
        [props.class || ""]: true,
      }}
      aria-label={props.label || "Copy to clipboard"}
      {...dataAttrs}
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
  );
};

export default CopyButton;
