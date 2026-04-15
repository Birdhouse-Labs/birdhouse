// ABOUTME: Auto-growing textarea that expands with content (no max height)
// ABOUTME: Handles Cmd/Ctrl+Enter to send, regular Enter for new lines

import { type Component, createEffect, createMemo, createResource, createSignal } from "solid-js";
import { useSkillCache } from "../../contexts/SkillCacheContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useWorkspaceAgentId } from "../../lib/routing";
import { fetchRecentAgentsList } from "../../services/agents-api";
import { fetchModels } from "../../services/messages-api";
import { uiSize } from "../../theme";
import { buildModelMarkdownLink } from "../../utils/modelLinks";
import { buildSkillMarkdownLink, buildSkillVisibleText } from "../../utils/skillLinks";
import AgentTypeahead from "./AgentTypeahead";
import FileTypeahead from "./FileTypeahead";
import ModelTypeahead, { type ModelItem } from "./ModelTypeahead";
import SkillTypeahead from "./SkillTypeahead";

export interface AutoGrowTextareaProps {
  value: string;
  onInput: (value: string) => void;
  onSend: () => void;
  onAttachmentsAdded?: ((files: File[]) => void | Promise<void>) | undefined;
  disabled?: boolean;
  placeholder?: string;
  ref?: ((el: HTMLTextAreaElement) => void) | undefined;
}

export const AutoGrowTextarea: Component<AutoGrowTextareaProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  const [showSkillTypeahead, setShowSkillTypeahead] = createSignal(false);
  const [showAgentTypeahead, setShowAgentTypeahead] = createSignal(false);
  const [showFileTypeahead, setShowFileTypeahead] = createSignal(false);
  const [showModelTypeahead, setShowModelTypeahead] = createSignal(false);
  const [cursorPosition, setCursorPosition] = createSignal(0);

  // Get workspace context
  const { workspaceId } = useWorkspace();
  const currentAgentId = useWorkspaceAgentId();

  // Get skills from cache (always up-to-date via SSE)
  const { skills: skillsData } = useSkillCache();

  // Load recent agents once on mount for the agent typeahead list
  const [agentsData] = createResource(() => fetchRecentAgentsList(workspaceId));

  // Load models once on mount
  const [modelsData] = createResource(() => fetchModels(workspaceId));

  // Transform to the skill typeahead shape
  const typeaheadSkills = () => {
    const skills = skillsData();
    if (!skills) return [];

    return skills.map((skill) => ({
      id: skill.id,
      triggerPhrases: skill.triggerPhrases,
      metadataTriggerPhrases: skill.metadataTriggerPhrases,
      title: skill.title,
    }));
  };

  // Get agents for agent typeahead
  const typeaheadAgents = () => {
    const agents = agentsData();
    return agents || [];
  };

  // Get models for model typeahead
  const typeaheadModels = (): ModelItem[] => {
    const models = modelsData();
    return models || [];
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
   * 1. @@@ → Model typeahead (highest priority)
   * 2. @@  → Agent typeahead
   * 3. @   → File typeahead
   * 4. text → Skill typeahead (lowest priority, shown when no @ triggers)
   *
   * @@@ is checked before @@ to prevent model trigger from activating agent typeahead.
   * @@ is checked before @ to prevent agent trigger from activating file typeahead.
   */
  const handleInput = (e: InputEvent & { currentTarget: HTMLTextAreaElement }) => {
    const newValue = e.currentTarget.value;
    const cursor = e.currentTarget.selectionStart;

    props.onInput(newValue);
    autoResize();

    // Update cursor position for typeahead positioning
    setCursorPosition(cursor);

    // Check trigger priority: @@@ first, then @@, then @, then pattern
    const textBeforeCursor = newValue.substring(0, cursor);
    const hasModelTrigger = textBeforeCursor.includes("@@@");
    const hasAgentTrigger = !hasModelTrigger && textBeforeCursor.includes("@@");
    const hasFileTrigger = !hasModelTrigger && !hasAgentTrigger && textBeforeCursor.includes("@");

    // Only one typeahead visible at a time - check in priority order
    if (hasModelTrigger) {
      // Priority 1: @@@ triggers model typeahead
      setShowModelTypeahead(true);
      setShowAgentTypeahead(false);
      setShowFileTypeahead(false);
      setShowSkillTypeahead(false);
    } else if (hasAgentTrigger) {
      // Priority 2: @@ triggers agent typeahead
      setShowAgentTypeahead(true);
      setShowModelTypeahead(false);
      setShowFileTypeahead(false);
      setShowSkillTypeahead(false);
    } else if (hasFileTrigger) {
      // Priority 3: @ triggers file typeahead
      setShowFileTypeahead(true);
      setShowModelTypeahead(false);
      setShowAgentTypeahead(false);
      setShowSkillTypeahead(false);
    } else {
      // Priority 4: No @ triggers - show skill typeahead if there's content
      setShowModelTypeahead(false);
      setShowAgentTypeahead(false);
      setShowFileTypeahead(false);
      const shouldShowSkill = newValue.length > 0;
      setShowSkillTypeahead(shouldShowSkill);
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
    const anyTypeaheadVisible =
      showSkillTypeahead() || showAgentTypeahead() || showFileTypeahead() || showModelTypeahead();
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

  const handlePaste = (e: ClipboardEvent & { currentTarget: HTMLTextAreaElement }) => {
    const items = Array.from(e.clipboardData?.items || []);
    const pastedFiles = items
      .filter((item) => item.kind === "file")
      .flatMap((item) => {
        const file = item.getAsFile();
        return file ? [file] : [];
      });

    if (pastedFiles.length === 0) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    void props.onAttachmentsAdded?.(pastedFiles);
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

  const handleSkillSelect = (
    skill: { id: string },
    matchedPhrase: string,
    matchedText: string,
    matchStartIndex: number,
  ) => {
    if (!textareaRef) return;

    const replacement = buildSkillMarkdownLink(buildSkillVisibleText(matchedText, matchedPhrase), skill.id);

    // Focus first
    textareaRef.focus();

    // Select the matched text
    textareaRef.setSelectionRange(matchStartIndex, matchStartIndex + matchedText.length);

    // Replace using document.execCommand (preserves undo stack)
    document.execCommand("insertText", false, replacement);

    setShowSkillTypeahead(false);

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

  /**
   * Handle model selection from typeahead
   *
   * Replaces "@@@query" with a canonical Birdhouse model markdown reference
   * (e.g. "[Claude Sonnet 4.6](birdhouse:model/anthropic/claude-sonnet-4-6)")
   * Uses document.execCommand to preserve undo stack
   */
  const handleModelSelect = (model: ModelItem, matchedText: string, matchStartIndex: number) => {
    if (!textareaRef) return;

    const replacement = buildModelMarkdownLink(model.id, model.name);

    // Focus first
    textareaRef.focus();

    // matchedText is "@@@query" - select from matchStartIndex to end of matchedText
    const selectionEnd = matchStartIndex + matchedText.length;
    textareaRef.setSelectionRange(matchStartIndex, selectionEnd);

    // Replace using document.execCommand (preserves undo stack)
    document.execCommand("insertText", false, replacement);

    setShowModelTypeahead(false);

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
        onPaste={handlePaste}
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
        visible={showSkillTypeahead()}
        skills={typeaheadSkills()}
        onSelect={handleSkillSelect}
        onClose={() => setShowSkillTypeahead(false)}
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
      <ModelTypeahead
        referenceElement={textareaRef}
        inputValue={props.value}
        cursorPosition={cursorPosition()}
        visible={showModelTypeahead()}
        models={typeaheadModels()}
        onSelect={handleModelSelect}
        onClose={() => setShowModelTypeahead(false)}
      />
    </div>
  );
};

export default AutoGrowTextarea;
