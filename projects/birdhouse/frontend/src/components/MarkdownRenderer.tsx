// ABOUTME: Markdown renderer with syntax-highlighted code blocks
// ABOUTME: Uses marked's custom renderer API for proper code block extraction

import { marked, type Tokens } from "marked";
import { type Component, createMemo, For, Suspense } from "solid-js";
import { borderColor, cardSurface } from "../styles/containerStyles";
import { codeTheme, isDark, uiSize } from "../theme";
import { resolveCodeTheme } from "../theme/codeThemes";
import { CodeBlockContainer } from "./ui";

interface CodeBlockInfo {
  code: string;
  language: string;
  id: string;
}

interface MarkdownPart {
  type: "html" | "codeblock";
  content: string;
  codeInfo?: CodeBlockInfo;
}

export interface GlobalReference {
  type: "agent" | "skill";
  identifier: string;
}

export interface MarkdownRendererProps {
  content: string;
  class?: string;
  isStreaming?: boolean;
  /** Workspace ID for agent links. If not provided, agent links won't work. */
  workspaceId?: string;
  onSkillLinkClick?: (skillName: string) => void;
  onReferenceLinkClick?: (
    reference: GlobalReference,
    modifiers?: {
      metaKey: boolean;
      ctrlKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
    },
  ) => void;
}

/**
 * Escape HTML to prevent XSS attacks
 * Used when interpolating untrusted content into HTML strings
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Skeleton loader shown while code block syntax highlighting loads
const CodeBlockSkeleton: Component<{ language: string }> = (props) => {
  const sizeClasses = () => {
    const size = uiSize();
    return {
      header: size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm",
      height: size === "sm" ? "h-16" : size === "md" ? "h-20" : "h-24",
    };
  };

  return (
    <div class={`rounded ${cardSurface} overflow-hidden`}>
      {/* Header */}
      <div
        class={`flex items-center justify-between px-3 py-2 bg-surface-overlay border-b ${borderColor}`}
        classList={{
          [sizeClasses().header]: true,
        }}
      >
        <span class="font-mono tracking-wider text-text-muted">{props.language}</span>
        <div class="w-16 h-6 bg-surface-raised/50 rounded animate-pulse" />
      </div>

      {/* Content skeleton */}
      <div
        class="bg-surface-raised animate-pulse"
        classList={{
          [sizeClasses().height]: true,
        }}
      />
    </div>
  );
};

export const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      prose: size === "sm" ? "prose-sm" : size === "md" ? "prose-base" : "prose-lg",
    };
  });

  // Parse markdown using marked's custom renderer
  const parsedParts = createMemo(() => {
    const parts: MarkdownPart[] = [];
    const codeBlocks: CodeBlockInfo[] = [];
    let currentId = 0;

    // Create a fresh renderer for this parse to avoid mutation issues
    const renderer = new marked.Renderer();

    // Save original table renderer before overriding
    const originalTableRenderer = renderer.table.bind(renderer);

    // Escape HTML tokens to prevent XSS attacks
    // This operates at the token level during parsing (not post-processing)
    // eliminating differential parsing vulnerabilities
    renderer.html = ({ text }: { text: string }) => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    // Override code block renderer to use placeholders
    // In marked v17+, renderer receives token object
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const id = `__CODE_BLOCK_${currentId++}__`;
      codeBlocks.push({
        code: text,
        language: lang || "text",
        id,
      });
      // Return placeholder that we'll replace later
      return id;
    };

    // Override link renderer to detect Birdhouse-specific reference links.
    const originalLink = renderer.link.bind(renderer);
    renderer.link = (token: { href: string; text: string; tokens?: unknown[]; type?: string; raw?: string }) => {
      if (token.href.startsWith("birdhouse:skill/")) {
        const skillName = token.href.replace("birdhouse:skill/", "");
        const escapedText = escapeHtml(token.text);

        const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" class="lucide lucide-library-big"><rect width="8" height="18" x="3" y="3" rx="1"></rect><path d="M7 3v18"></path><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"></path></svg>`;

        return `<button data-skill-link="${skillName}" class="agent-btn inline-flex items-center gap-1 rounded font-medium cursor-pointer" style="transition: transform 100ms ease-in-out;" onmousemove="const rect = this.getBoundingClientRect(); const x = event.clientX - rect.left; const percent = (x / rect.width * 100); this.style.setProperty('--mouse-x', percent + '%');" onmouseleave="this.style.removeProperty('--mouse-x');">${icon}${escapedText}</button>`;
      }

      if (token.href.startsWith("birdhouse:model/")) {
        const modelId = token.href.replace("birdhouse:model/", "");
        const escapedText = escapeHtml(token.text);
        const escapedModelId = escapeHtml(modelId);

        const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" class="lucide lucide-cpu"><rect width="16" height="16" x="4" y="4" rx="2"></rect><rect width="6" height="6" x="9" y="9" rx="1"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path></svg>`;

        return `<span data-model-link="${escapedModelId}" class="inline-flex items-center gap-1 rounded font-medium text-text-primary">${icon}${escapedText}</span>`;
      }

      if (token.href.startsWith("birdhouse:agent/")) {
        const agentId = token.href.replace("birdhouse:agent/", "");
        const escapedText = escapeHtml(token.text);

        // Bot icon SVG (from lucide-solid)
        const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" class="lucide lucide-bot"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`;

        // Cursor-controlled gradient effect with anchor tag for cmd+click support
        // Only render full link if workspaceId is available
        const href = props.workspaceId ? `#/workspace/${props.workspaceId}/agent/${agentId}` : "#";
        return `<a href="${href}" data-agent-link="${agentId}" class="agent-btn inline-flex items-center gap-1 rounded font-medium cursor-pointer no-underline" style="transition: transform 100ms ease-in-out;" onmousemove="const rect = this.getBoundingClientRect(); const x = event.clientX - rect.left; const percent = (x / rect.width * 100); this.style.setProperty('--mouse-x', percent + '%');" onmouseleave="this.style.removeProperty('--mouse-x');">${icon}${escapedText}</a>`;
      }

      // Normal link - use original renderer
      return originalLink({
        href: token.href,
        text: token.text,
        tokens: (token.tokens || []) as Tokens.Generic[],
        type: "link",
        raw: token.raw || "",
      });
    };

    // Override table renderer to add horizontal scroll wrapper
    renderer.table = (token) => {
      const tableHtml = originalTableRenderer(token);
      return `<div class="overflow-x-auto -webkit-overflow-scrolling-touch my-4">${tableHtml}</div>`;
    };

    // Parse markdown with custom renderer
    const html = marked.parse(props.content, {
      renderer: renderer,
      async: false,
      gfm: true,
      breaks: false,
    }) as string;

    // Split HTML by our placeholders and reconstruct with components
    let remainingHtml = html;
    codeBlocks.forEach((block) => {
      const parts_split = remainingHtml.split(block.id);
      const before = parts_split[0];
      const after = parts_split.slice(1).join(block.id); // Handle if placeholder appears in content

      if (before) {
        parts.push({ type: "html", content: before });
      }
      parts.push({ type: "codeblock", content: "", codeInfo: block });
      remainingHtml = after;
    });

    // Add any remaining HTML
    if (remainingHtml) {
      parts.push({ type: "html", content: remainingHtml });
    }

    return parts;
  });

  // Memoize resolved theme to avoid reactive tracking in For loop
  const resolvedTheme = createMemo(() => resolveCodeTheme(codeTheme(), isDark()));

  // Memoize isDark to avoid repeated reactive reads
  const proseInvert = createMemo(() => isDark());

  const handleReferenceClick = (e: Event) => {
    const target = e.target as HTMLElement;

    if (target.hasAttribute("data-skill-link")) {
      e.preventDefault();
      const skillName = target.getAttribute("data-skill-link");

      if (skillName && props.onSkillLinkClick) {
        props.onSkillLinkClick(skillName);
        return;
      }

      if (skillName && props.onReferenceLinkClick) {
        props.onReferenceLinkClick({
          type: "skill",
          identifier: skillName,
        });
      }
    }

    if (target.hasAttribute("data-agent-link")) {
      const mouseEvent = e as MouseEvent;

      // Cmd/Ctrl+click: let browser open in new tab natively
      if (mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey) {
        return;
      }

      // Normal click: prevent navigation and use callback
      e.preventDefault();
      const agentId = target.getAttribute("data-agent-link");

      if (agentId && props.onReferenceLinkClick) {
        props.onReferenceLinkClick(
          {
            type: "agent",
            identifier: agentId,
          },
          {
            metaKey: mouseEvent.metaKey,
            ctrlKey: mouseEvent.ctrlKey,
            altKey: mouseEvent.altKey,
            shiftKey: mouseEvent.shiftKey,
          },
        );
      }
    }
  };

  const handleClick = (e: MouseEvent) => {
    handleReferenceClick(e);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      handleReferenceClick(e);
    }
  };

  return (
    <>
      {/* CSS for agent button effects */}
      <style>{`
        /* Active (click) feedback - scale down slightly */
        .agent-btn:active {
          transform: scale(0.95);
        }
        
        /* Cursor-controlled gradient on text only */
        .agent-btn {
          background: linear-gradient(
            to right,
            var(--theme-gradient-from) 0%,
            var(--theme-gradient-from) calc(var(--mouse-x, -100%) - 20%),
            var(--theme-gradient-to) calc(var(--mouse-x, -100%) + 20%),
            var(--theme-gradient-to) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        /* SVG icons start at gradient-to, switch to gradient-from on hover (no animation) */
        .agent-btn svg {
          color: var(--theme-gradient-to);
        }
        
        .agent-btn:hover svg {
          color: var(--theme-gradient-from);
        }
      `}</style>

      {/* biome-ignore lint/a11y/noStaticElementInteractions: Event delegation for dynamically generated skill links in markdown */}
      <div
        class={`prose max-w-none ${props.class || ""}`}
        classList={{
          [sizeClasses().prose]: true,
          "prose-invert": proseInvert(),
        }}
        style={{
          "overflow-wrap": "break-word",
          "word-break": "break-word",
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <For each={parsedParts()}>
          {(part) => {
            if (part.type === "html") {
              // HTML is already escaped by renderer.html() during parsing
              // No post-processing sanitization needed
              return <div innerHTML={part.content} />;
            }
            if (part.type === "codeblock" && part.codeInfo) {
              return (
                <div class="my-4 not-prose">
                  <Suspense fallback={<CodeBlockSkeleton language={part.codeInfo.language} />}>
                    <CodeBlockContainer
                      code={part.codeInfo.code}
                      language={part.codeInfo.language}
                      theme={resolvedTheme()}
                      showCopyButton={true}
                      highlightingEnabled={!props.isStreaming}
                    />
                  </Suspense>
                </div>
              );
            }
            return null;
          }}
        </For>
      </div>
    </>
  );
};

export default MarkdownRenderer;
