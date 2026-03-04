// ABOUTME: Renders the "question" tool call inline in the chat message stream
// ABOUTME: Shows an interactive form when running, compact summary when completed

import { CheckCircle2, HelpCircle } from "lucide-solid";
import { type Component, createMemo, createSignal, For, Show } from "solid-js";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { replyToQuestion } from "../../services/questions-api";
import type { ToolBlock } from "../../types/messages";
import type { QuestionItem, QuestionRequest } from "../../types/question";

export interface QuestionToolCardProps {
  block: ToolBlock;
  agentId: string;
  // undefined = not yet known; null = no pending question found; populated = use for interactive form
  pendingQuestion?: QuestionRequest | null | undefined;
  // Called after a successful reply so the parent can remove it from pendingQuestions
  onAnswered?: (questionId: string) => void;
}

// Derive question items from either the pendingQuestion prop or block.input fallback
function resolveQuestions(
  pendingQuestion: QuestionRequest | null | undefined,
  block: ToolBlock,
): QuestionItem[] | null {
  if (pendingQuestion) {
    return pendingQuestion.questions;
  }
  // Fall back to block.input when status is running
  const inputQuestions = block.input["questions"];
  if (Array.isArray(inputQuestions)) {
    return inputQuestions as QuestionItem[];
  }
  return null;
}

// Parse output for the completed summary.
// Returns array of answer arrays if JSON, otherwise wraps the raw string.
function parseOutput(output: string | undefined): string[][] | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "answers" in parsed &&
      Array.isArray((parsed as { answers: unknown }).answers)
    ) {
      return (parsed as { answers: string[][] }).answers;
    }
  } catch {
    // Not JSON
  }
  return [[output]];
}

// ─── Sub-component: single question form section ────────────────────────────

interface QuestionFormSectionProps {
  question: QuestionItem;
  index: number;
  selectedOptions: string[];
  customText: string;
  onOptionToggle: (label: string) => void;
  // Changing custom text clears radio selections (single-select) so it's unambiguous
  onCustomTextChange: (text: string) => void;
  onClearOptions: () => void;
}

const QuestionFormSection: Component<QuestionFormSectionProps> = (props) => {
  return (
    <div class="space-y-3">
      {/* Header + question text */}
      <div>
        <div class="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">
          {props.question.header}
        </div>
        <div class="text-sm text-text-primary">{props.question.question}</div>
      </div>

      {/* Options */}
      <div class="space-y-2">
        <For each={props.question.options}>
          {(option) => {
            const isSelected = () => props.selectedOptions.includes(option.label);

            return (
              <label
                class="flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition-colors"
                classList={{
                  "border-accent bg-accent/5": isSelected(),
                  "border-border hover:border-accent/50 hover:bg-surface-overlay/30": !isSelected(),
                }}
              >
                <Show
                  when={props.question.multiple}
                  fallback={
                    <input
                      type="radio"
                      name={`question-${props.index}`}
                      value={option.label}
                      checked={isSelected()}
                      onChange={() => props.onOptionToggle(option.label)}
                      class="mt-0.5 flex-shrink-0 accent-[var(--color-accent)]"
                    />
                  }
                >
                  <input
                    type="checkbox"
                    value={option.label}
                    checked={isSelected()}
                    onChange={() => props.onOptionToggle(option.label)}
                    class="mt-0.5 flex-shrink-0 accent-[var(--color-accent)]"
                  />
                </Show>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-text-primary">{option.label}</div>
                  <div class="text-xs text-text-secondary mt-0.5">{option.description}</div>
                </div>
              </label>
            );
          }}
        </For>
      </div>

      {/* Free-text option — styled like the other options with its own indicator */}
      {(() => {
        const isCustomActive = () => props.customText.trim().length > 0;
        return (
          <label
            class="flex items-start gap-3 cursor-text rounded-lg border p-3 transition-colors"
            classList={{
              "border-accent bg-accent/5": isCustomActive(),
              "border-border hover:border-accent/50 hover:bg-surface-overlay/30": !isCustomActive(),
            }}
          >
            <input
              type={props.question.multiple ? "checkbox" : "radio"}
              name={`question-${props.index}`}
              checked={isCustomActive()}
              readOnly
              tabIndex={-1}
              class="mt-0.5 flex-shrink-0 accent-[var(--color-accent)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Type your own answer"
              value={props.customText}
              onInput={(e) => {
                // For single-select: typing clears radio selection to avoid ambiguity
                if (!props.question.multiple && e.currentTarget.value.trim()) {
                  props.onClearOptions();
                }
                props.onCustomTextChange(e.currentTarget.value);
              }}
              class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
          </label>
        );
      })()}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const QuestionToolCard: Component<QuestionToolCardProps> = (props) => {
  const { workspaceId } = useWorkspace();

  // Per-question selection state: outer array = question index, inner = selected labels
  const [selectedOptions, setSelectedOptions] = createSignal<string[][]>([]);
  // Per-question free-text state
  const [customTexts, setCustomTexts] = createSignal<string[]>([]);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  // Determine what questions to show
  const questions = createMemo(() => resolveQuestions(props.pendingQuestion, props.block));

  // Initialize state arrays when questions change
  const initStateForQuestions = (qs: QuestionItem[]) => {
    setSelectedOptions(qs.map(() => []));
    setCustomTexts(qs.map(() => ""));
  };

  // Build answers array for submission: per question, combine selected options + custom text
  const buildAnswers = (): string[][] => {
    const qs = questions();
    if (!qs) return [];
    return qs.map((_, i) => {
      const opts = selectedOptions()[i] ?? [];
      const custom = customTexts()[i] ?? "";
      const allAnswers = [...opts];
      if (custom.trim()) allAnswers.push(custom.trim());
      return allAnswers;
    });
  };

  // Submit is enabled only when every question has at least one answer
  const canSubmit = createMemo(() => {
    const qs = questions();
    if (!qs || qs.length === 0) return false;
    return buildAnswers().every((a) => a.length > 0);
  });

  const handleOptionToggle = (qIndex: number, label: string) => {
    const qs = questions();
    if (!qs) return;
    const question = qs[qIndex];
    if (!question) return;

    // Selecting a radio/checkbox clears the custom text for single-select to avoid ambiguity
    if (!question.multiple) {
      handleCustomTextChange(qIndex, "");
    }

    setSelectedOptions((prev) => {
      const next = [...prev];
      const current = next[qIndex] ?? [];
      if (question.multiple) {
        // Toggle checkbox
        next[qIndex] = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
      } else {
        // Replace radio
        next[qIndex] = [label];
      }
      return next;
    });
  };

  const handleClearOptions = (qIndex: number) => {
    setSelectedOptions((prev) => {
      const next = [...prev];
      next[qIndex] = [];
      return next;
    });
  };

  const handleCustomTextChange = (qIndex: number, text: string) => {
    setCustomTexts((prev) => {
      const next = [...prev];
      next[qIndex] = text;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit() || isSubmitting()) return;

    const qs = questions();
    if (!qs) return;

    // requestId: prefer pendingQuestion.id, fall back to block.callID
    const requestId = props.pendingQuestion?.id ?? props.block.callID;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await replyToQuestion(workspaceId, props.agentId, requestId, buildAnswers());
      // Notify parent to remove from pendingQuestions
      props.onAnswered?.(requestId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Completed state: compact read-only summary ──
  if (props.block.status === "completed") {
    const answers = parseOutput(props.block.output);
    const flatAnswers = answers ? answers.flat() : [];

    return (
      <div class="my-2 px-3 py-1.5">
        <div class="flex items-center gap-1.5 flex-wrap">
          <HelpCircle size={16} class="text-text-primary flex-shrink-0" />
          <span class="text-sm text-text-secondary">Answered</span>
          <Show when={flatAnswers.length > 0} fallback={<span class="text-sm text-text-muted">question</span>}>
            <span class="text-sm text-text-primary font-medium">{flatAnswers.join(", ")}</span>
          </Show>
          <div class="ml-auto flex items-center gap-2">
            <CheckCircle2 size={16} class="text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>
    );
  }

  // ── Pending block status (AI still constructing parameters): spinner ──
  if (props.block.status === "pending") {
    return (
      <div class="my-2 px-3 py-1.5">
        <div class="flex items-center gap-1.5">
          <HelpCircle size={16} class="text-text-primary flex-shrink-0" />
          <span class="text-sm text-text-secondary">Preparing question</span>
          <div class="ml-auto">
            <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />
          </div>
        </div>
      </div>
    );
  }

  // ── Running state ──
  const qs = questions();

  // No question data yet (pendingQuestion not resolved, block.input has no questions)
  if (!qs) {
    return (
      <div class="my-2 px-3 py-1.5">
        <div class="flex items-center gap-1.5">
          <HelpCircle size={16} class="text-text-primary flex-shrink-0" />
          <span class="text-sm text-text-secondary">Waiting for question</span>
          <div class="ml-auto">
            <div class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />
          </div>
        </div>
      </div>
    );
  }

  // Ensure state arrays are sized correctly for current question count
  if (selectedOptions().length !== qs.length) {
    initStateForQuestions(qs);
  }

  return (
    <div class="my-2 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div class="px-3 py-2 flex items-center gap-2 border-b border-border bg-surface-overlay/30">
        <HelpCircle size={16} class="text-accent flex-shrink-0" />
        <span class="text-sm font-medium text-text-primary">
          {qs.length === 1 ? "Question" : `${qs.length} Questions`}
        </span>
        <Show when={isSubmitting()}>
          <div class="ml-auto animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent" />
        </Show>
      </div>

      {/* Question sections */}
      <div class="px-3 py-3 space-y-5 bg-surface-raised">
        <For each={qs}>
          {(question, i) => (
            <QuestionFormSection
              question={question}
              index={i()}
              selectedOptions={selectedOptions()[i()] ?? []}
              customText={customTexts()[i()] ?? ""}
              onOptionToggle={(label) => handleOptionToggle(i(), label)}
              onCustomTextChange={(text) => handleCustomTextChange(i(), text)}
              onClearOptions={() => handleClearOptions(i())}
            />
          )}
        </For>

        {/* Error display */}
        <Show when={submitError()}>
          <div class="text-sm text-red-600 dark:text-red-400">{submitError()}</div>
        </Show>

        {/* Submit */}
        <div class="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting()}
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            classList={{
              "bg-accent text-text-on-accent hover:brightness-110 cursor-pointer": canSubmit() && !isSubmitting(),
              "bg-surface-overlay text-text-muted cursor-not-allowed opacity-50": !canSubmit() || isSubmitting(),
            }}
          >
            <Show when={isSubmitting()} fallback="Submit">
              Submitting...
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionToolCard;
