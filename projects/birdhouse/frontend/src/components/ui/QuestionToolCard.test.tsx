// ABOUTME: Unit tests for QuestionToolCard component
// ABOUTME: Tests pending/running/completed states, option selection, and submit behavior

import { render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import type { ToolBlock } from "../../types/messages";
import type { QuestionRequest } from "../../types/question";
import QuestionToolCard from "./QuestionToolCard";

// Mock useWorkspace hook
vi.mock("../../contexts/WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "test-workspace" }),
}));

// Mock questions API
vi.mock("../../services/questions-api", () => ({
  replyToQuestion: vi.fn(),
}));

import * as questionsApi from "../../services/questions-api";

// Helper: build a minimal ToolBlock for "question" tool
function makeBlock(overrides: Partial<ToolBlock> = {}): ToolBlock {
  return {
    id: "block-1",
    type: "tool",
    callID: "call-abc",
    name: "question",
    status: "running",
    input: {
      questions: [
        {
          question: "What is your favorite color?",
          header: "Favorite color",
          options: [
            { label: "Red", description: "A warm color" },
            { label: "Blue", description: "A cool color" },
          ],
          multiple: false,
        },
      ],
    },
    ...overrides,
  };
}

// Helper: build a QuestionRequest matching the block
function makePendingQuestion(overrides: Partial<QuestionRequest> = {}): QuestionRequest {
  return {
    id: "req-123",
    sessionID: "session-abc",
    questions: [
      {
        question: "What is your favorite color?",
        header: "Favorite color",
        options: [
          { label: "Red", description: "A warm color" },
          { label: "Blue", description: "A cool color" },
        ],
        multiple: false,
      },
    ],
    tool: { messageID: "msg-1", callID: "call-abc" },
    ...overrides,
  };
}

describe("QuestionToolCard - pending state", () => {
  it("shows spinner when block.status is pending", () => {
    render(() => <QuestionToolCard block={makeBlock({ status: "pending" })} agentId="agent-1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("shows spinner when block.status is running but block.input has no questions and no pending question found", () => {
    const blockNoInput = makeBlock({ input: {} });
    render(() => <QuestionToolCard block={blockNoInput} agentId="agent-1" pendingQuestions={() => []} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("shows spinner when block.status is running but block.input has no questions and pendingQuestions not provided", () => {
    const blockNoInput = makeBlock({ input: {} });
    render(() => <QuestionToolCard block={blockNoInput} agentId="agent-1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });
});

describe("QuestionToolCard - running state with pendingQuestions", () => {
  it("shows question text", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
  });

  it("shows question header", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByText("Favorite color")).toBeInTheDocument();
  });

  it("shows option labels", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("shows option descriptions", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByText("A warm color")).toBeInTheDocument();
    expect(screen.getByText("A cool color")).toBeInTheDocument();
  });

  it("renders radio inputs for single-select questions", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    const radios = screen.getAllByRole("radio");
    // 2 option radios + 1 for the custom text row
    expect(radios.length).toBe(3);
  });

  it("renders checkboxes for multi-select questions", () => {
    const block = makeBlock({
      input: {
        questions: [
          {
            question: "Pick all that apply",
            header: "Multi pick",
            options: [
              { label: "Option A", description: "Desc A" },
              { label: "Option B", description: "Desc B" },
            ],
            multiple: true,
          },
        ],
      },
    });
    const pendingQ = makePendingQuestion({
      questions: [
        {
          question: "Pick all that apply",
          header: "Multi pick",
          options: [
            { label: "Option A", description: "Desc A" },
            { label: "Option B", description: "Desc B" },
          ],
          multiple: true,
        },
      ],
    });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);
    const checkboxes = screen.getAllByRole("checkbox");
    // Checkboxes include the Checkbox component's hidden inputs
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("always shows free-text input", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByPlaceholderText("Type your own answer")).toBeInTheDocument();
  });

  it("disables submit button when nothing selected", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    const submit = screen.getByRole("button", { name: /submit/i });
    expect(submit).toBeDisabled();
  });

  it("enables submit button after selecting a radio option", async () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    const radios = screen.getAllByRole("radio");
    radios[0]?.click();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });
  });

  it("enables submit button after typing in text input", async () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    const textInput = screen.getByPlaceholderText("Type your own answer");
    // Simulate input event
    Object.defineProperty(textInput, "value", { value: "my answer", writable: true });
    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });
  });

  it("calls replyToQuestion with pendingQuestion.id as requestId on submit", async () => {
    const replyMock = vi.mocked(questionsApi.replyToQuestion);
    replyMock.mockResolvedValue(undefined);

    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));

    // Select an option
    const radios = screen.getAllByRole("radio");
    radios[0]?.click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });

    screen.getByRole("button", { name: /submit/i }).click();

    await waitFor(() => {
      expect(replyMock).toHaveBeenCalledWith("test-workspace", "agent-1", "req-123", [["Red"]]);
    });
  });

  it("uses block.callID as requestId when no pending question matches and block.status is running", async () => {
    const replyMock = vi.mocked(questionsApi.replyToQuestion);
    replyMock.mockResolvedValue(undefined);

    // No pendingQuestions provided — falls back to block.input
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);

    // With no matching pending question and status=running, the form renders using block.input
    await waitFor(() => {
      expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
    });

    const radios = screen.getAllByRole("radio");
    radios[0]?.click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });

    screen.getByRole("button", { name: /submit/i }).click();

    // Should use block.callID as requestId
    await waitFor(() => {
      expect(replyMock).toHaveBeenCalledWith("test-workspace", "agent-1", "call-abc", [["Red"]]);
    });
  });

  it("shows loading state while submitting", async () => {
    let resolveReply: (() => void) | undefined;
    const replyMock = vi.mocked(questionsApi.replyToQuestion);
    replyMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReply = resolve;
        }),
    );

    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));

    const radios = screen.getAllByRole("radio");
    radios[0]?.click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });

    screen.getByRole("button", { name: /submit/i }).click();

    // Should show loading state
    await waitFor(() => {
      const spinner = document.querySelector(".animate-spin");
      expect(spinner).not.toBeNull();
    });

    resolveReply?.();
  });
});

describe("QuestionToolCard - running state fallback to block.input", () => {
  it("renders form from block.input when pendingQuestions not provided and status is running", async () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
    });
  });
});

describe("QuestionToolCard - completed state", () => {
  it("shows compact summary when completed with JSON output", () => {
    const block = makeBlock({
      status: "completed",
      output: JSON.stringify({ answers: [["Red"]] }),
    });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    // Should show answered label/summary, not the form
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("shows raw output when completed output is not JSON", () => {
    const block = makeBlock({
      status: "completed",
      output: "Red",
    });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("shows fallback when completed with no output", () => {
    const block = makeBlock({ status: "completed" });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    // Should render without crashing and show some completed indication
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });
});

describe("QuestionToolCard - multiple questions", () => {
  it("renders all questions", () => {
    const questions = [
      {
        question: "First question?",
        header: "Q1",
        options: [{ label: "Yes", description: "Affirmative" }],
        multiple: false,
      },
      {
        question: "Second question?",
        header: "Q2",
        options: [{ label: "Maybe", description: "Uncertain" }],
        multiple: false,
      },
    ];
    const block = makeBlock({ input: { questions } });
    const pendingQ = makePendingQuestion({ questions });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);

    expect(screen.getByText("First question?")).toBeInTheDocument();
    expect(screen.getByText("Second question?")).toBeInTheDocument();
  });

  it("requires all questions answered before submit enabled", async () => {
    const questions = [
      {
        question: "First question?",
        header: "Q1",
        options: [{ label: "Yes", description: "Affirmative" }],
        multiple: false,
      },
      {
        question: "Second question?",
        header: "Q2",
        options: [{ label: "Maybe", description: "Uncertain" }],
        multiple: false,
      },
    ];
    const block = makeBlock({ input: { questions } });
    const pendingQ = makePendingQuestion({ questions });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);

    const radios = screen.getAllByRole("radio");
    // Only click first radio
    radios[0]?.click();

    // Submit should still be disabled (second question not answered)
    await waitFor(() => {
      // Check that submit button remains disabled
      const submit = screen.getByRole("button", { name: /submit/i });
      expect(submit).toBeDisabled();
    });
  });
});

describe("QuestionToolCard - interrupted state", () => {
  it("shows interrupted state when status=running and isInterrupted=true", () => {
    render(() => (
      <QuestionToolCard
        block={makeBlock()}
        agentId="agent-1"
        pendingQuestions={() => [makePendingQuestion()]}
        isInterrupted={true}
      />
    ));
    expect(screen.getByText("Question interrupted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("shows interactive form when status=running and isInterrupted=false", () => {
    render(() => (
      <QuestionToolCard
        block={makeBlock()}
        agentId="agent-1"
        pendingQuestions={() => [makePendingQuestion()]}
        isInterrupted={false}
      />
    ));
    expect(screen.queryByText("Question interrupted")).toBeNull();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("shows interactive form when isInterrupted is omitted", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.queryByText("Question interrupted")).toBeNull();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("shows completed summary even when isInterrupted=true", () => {
    const block = makeBlock({ status: "completed", output: JSON.stringify({ answers: [["Red"]] }) });
    render(() => <QuestionToolCard block={block} agentId="agent-1" isInterrupted={true} />);
    expect(screen.queryByText("Question interrupted")).toBeNull();
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("shows pending spinner even when isInterrupted=true", () => {
    render(() => <QuestionToolCard block={makeBlock({ status: "pending" })} agentId="agent-1" isInterrupted={true} />);
    expect(screen.queryByText("Question interrupted")).toBeNull();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });
});
