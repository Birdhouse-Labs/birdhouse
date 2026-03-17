// ABOUTME: Auto-growing textarea that expands with content (no max height)
// ABOUTME: Handles Cmd/Ctrl+Enter to send, regular Enter for new lines

import { type Component, createEffect, createMemo, createResource, createSignal } from "solid-js";
import { useSkillCache } from "../../contexts/SkillCacheContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useWorkspaceAgentId } from "../../lib/routing";
import { fetchAgentsForTypeahead } from "../../services/agents-api";
import { uiSize } from "../../theme";
import { buildSkillMarkdownLink, buildSkillVisibleText } from "../../utils/skillLinks";
import AgentTypeahead from "./AgentTypeahead";
import FileTypeahead from "./FileTypeahead";
import SkillTypeahead from "./SkillTypeahead";

export interface AutoGrowTextareaProps {
  value: string;
  onInput: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  ref?: ((el: HTMLTextAreaElement) => void) | undefined;
}

export const AutoGrowTextarea: Component<AutoGrowTextareaProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  const [showPatternTypeahead, setShowPatternTypeahead] = createSignal(false);
  const [showAgentTypeahead, setShowAgentTypeahead] = createSignal(false);
  const [showFileTypeahead, setShowFileTypeahead] = createSignal(false);
  const [cursorPosition, setCursorPosition] = createSignal(0);

  // Get workspace context
  const { workspaceId } = useWorkspace();
  const currentAgentId = useWorkspaceAgentId();

  // Get patterns from cache (always up-to-date via SSE)
  const { patterns: patternsData } = useSkillCache();

  // Load agents once on mount
  const [agentsData] = createResource(() => fetchAgentsForTypeahead(workspaceId));

  // Transform to Pattern shape for typeahead
  const typeaheadPatterns = () => {
    const patterns = patternsData();
    if (!patterns) return [];

    return patterns.map((p) => ({
      id: p.id,
      triggerPhrases: p.triggerPhrases,
      title: p.title,
    }));
  };

  // Get agents for agent typeahead
  const typeaheadAgents = () => {
    const agents = agentsData();
    return agents || [];
  };

  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      text: size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg",
    };
  });

  const textareaStyles = createMemo(() => {
    const size = uiSize();
    return {
      resize: "none" as const,
      "min-height": size === "sm" ? "38px" : size === "md" ? "40px" : "42px",
      "max-height": "50vh",
      overflow: "hidden" as const,
      "line-height": "1.5",
    };
  });

  const autoResize = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      // Cap at 50vh (half viewport height) to leave room for messages
      const maxHeight = window.innerHeight * 0.5;
      const newHeight = Math.min(textareaRef.scrollHeight, maxHeight);
      textareaRef.style.height = `${newHeight}px`;

      // Only show scrollbar when content exceeds max height
      if (textareaRef.scrollHeight > maxHeight) {
        textareaRef.style.overflow = "auto";
      } else {
        textareaRef.style.overflow = "hidden";
      }
    }
  };

  /**
   * Handle textarea input and determine which typeahead to show
   *
   * Trigger priority order (only one typeahead shows at a time):
   * 1. @@ → Agent typeahead (highest priority)
   * 2. @  → File typeahead (medium priority)
   * 3. text → Pattern typeahead (lowest priority, shown when no @ triggers)
   *
   * Why @@ is checked before @:
   * - Prevents @@ from triggering file typeahead
   * - Agent mentions should take precedence over file paths
   * - Example: "Check @@agent and @file" → shows agent typeahead for @@
   */
  const handleInput = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    const newValue = e.currentTarget.value;
    const cursor = e.currentTarget.selectionStart;

    props.onInput(newValue);
    autoResize();

    // Update cursor position for typeahead positioning
    setCursorPosition(cursor);

    // Check trigger priority: @@ first, then @, then pattern
    const textBeforeCursor = newValue.substring(0, cursor);
    const hasAgentTrigger = textBeforeCursor.includes("@@");
    const hasFileTrigger = textBeforeCursor.includes("@");

    // Only one typeahead visible at a time - check in priority order
    if (hasAgentTrigger) {
      // Priority 1: @@ triggers agent typeahead
      setShowAgentTypeahead(true);
      setShowFileTypeahead(false);
      setShowPatternTypeahead(false);
    } else if (hasFileTrigger) {
      // Priority 2: @ triggers file typeahead (only when @@ not present)
      setShowFileTypeahead(true);
      setShowAgentTypeahead(false);
      setShowPatternTypeahead(false);
    } else {
      // Priority 3: No @ triggers - show pattern typeahead if there's content
      setShowAgentTypeahead(false);
      setShowFileTypeahead(false);
      const shouldShowPattern = newValue.length > 0;
      setShowPatternTypeahead(shouldShowPattern);
    }
  };

  const updateCursorPosition = () => {
    if (textareaRef) {
      setCursorPosition(textareaRef.selectionStart);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Update cursor position on arrow keys
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      queueMicrotask(updateCursorPosition);
    }

    // When any typeahead is visible, let it handle arrow keys and Escape
    const anyTypeaheadVisible = showPatternTypeahead() || showAgentTypeahead() || showFileTypeahead();
    if (anyTypeaheadVisible && ["ArrowUp", "ArrowDown", "Escape"].includes(e.key)) {
      // Typeahead components will handle these
      return;
    }

    // Plain Enter with typeahead visible - let Typeahead handle selection
    // But Shift+Enter should always insert newline
    if (anyTypeaheadVisible && e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      return;
    }

    // Cmd/Ctrl+Enter always sends (whether typeahead is visible or not)
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      props.onSend();
    }
  };

  // Reset height when value is cleared
  createEffect(() => {
    if (!props.value && textareaRef) {
      textareaRef.style.height = "auto";
    }
  });

  // Auto-resize when value changes (including programmatic updates like localStorage)
  createEffect(() => {
    props.value;
    if (textareaRef) {
      queueMicrotask(() => autoResize());
    }
  });

  const handlePatternSelect = (
    pattern: { id: string },
    matchedPhrase: string,
    matchedText: string,
    matchStartIndex: number,
  ) => {
    if (!textareaRef) return;

    const replacement = buildSkillMarkdownLink(buildSkillVisibleText(matchedText, matchedPhrase), pattern.id);

    // Focus first
    textareaRef.focus();

    // Select the matched text
    textareaRef.setSelectionRange(matchStartIndex, matchStartIndex + matchedText.length);

    // Replace using document.execCommand (preserves undo stack)
    document.execCommand("insertText", false, replacement);

    setShowPatternTypeahead(false);

    // Cursor is automatically positioned after the replacement by insertText
  };

  const handleAgentSelect = (agent: { id: string; title: string }, matchedText: string, matchStartIndex: number) => {
    if (!textareaRef) return;

    // Replace @@ trigger and matched text with agent reference
    const replacement = `[${agent.title}](birdhouse:agent/${agent.id})`;

    // Focus first
    textareaRef.focus();

    // Select from @@ trigger (@@) to end of matched text
    // matchStartIndex is where @@ starts, so we need to include @@ (2 chars) + matchedText
    const selectionEnd = matchStartIndex + 2 + matchedText.length;
    textareaRef.setSelectionRange(matchStartIndex, selectionEnd);

    // Replace using document.execCommand (preserves undo stack)
    document.execCommand("insertText", false, replacement);

    setShowAgentTypeahead(false);

    // Cursor is automatically positioned after the replacement by insertText
  };

  /**
   * Handle file selection from typeahead
   *
   * Replaces "@query" with markdown link: [filename](absolute/path)
   * Uses document.execCommand to preserve undo stack
   *
   * Example: "@Auto" → "[AutoGrowTextarea.tsx](src/components/ui/AutoGrowTextarea.tsx)"
   */
  const handleFileSelect = (file: { name: string; path: string }, matchedText: string, matchStartIndex: number) => {
    if (!textareaRef) return;

    // Create markdown link with filename as text and absolute path as URL
    const replacement = `[${file.name}](${file.path})`;

    // Focus first
    textareaRef.focus();

    // Select from @ trigger to end of matched text
    // matchStartIndex points to @, matchedText includes @ and query (e.g., "@Auto")
    // Need to select: @ (1 char) + query text
    const selectionEnd = matchStartIndex + 1 + matchedText.length;
    textareaRef.setSelectionRange(matchStartIndex, selectionEnd);

    // Replace using document.execCommand (preserves undo stack for Cmd+Z)
    document.execCommand("insertText", false, replacement);

    setShowFileTypeahead(false);

    // Cursor is automatically positioned after the replacement by insertText
  };

  return (
    <div class="flex-1 relative flex items-end">
      <textarea
        ref={(el) => {
          textareaRef = el;
          props.ref?.(el);
        }}
        value={props.value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={updateCursorPosition}
        disabled={props.disabled}
        placeholder={props.placeholder || "Type a message..."}
        rows={1}
        class="w-full rounded-lg border bg-surface border-border text-text-primary placeholder-text-muted px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        classList={{
          [sizeClasses().text]: true,
        }}
        style={textareaStyles()}
      />
      <SkillTypeahead
        referenceElement={textareaRef}
        inputValue={props.value}
        cursorPosition={cursorPosition()}
        visible={showPatternTypeahead()}
        skills={typeaheadPatterns()}
        onSelect={handlePatternSelect}
        onClose={() => setShowPatternTypeahead(false)}
      />
      <AgentTypeahead
        referenceElement={textareaRef}
        inputValue={props.value}
        cursorPosition={cursorPosition()}
        visible={showAgentTypeahead()}
        agents={typeaheadAgents()}
        currentAgentId={currentAgentId()}
        onSelect={handleAgentSelect}
        onClose={() => setShowAgentTypeahead(false)}
      />
      <FileTypeahead
        referenceElement={textareaRef}
        inputValue={props.value}
        cursorPosition={cursorPosition()}
        visible={showFileTypeahead()}
        workspaceId={workspaceId}
        onSelect={handleFileSelect}
        onClose={() => setShowFileTypeahead(false)}
      />
    </div>
  );
};

export default AutoGrowTextarea;
