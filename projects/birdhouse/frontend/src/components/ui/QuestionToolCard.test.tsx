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

describe("QuestionToolCard - block.status pending (AI constructing)", () => {
  it("shows spinner when block.status is pending", () => {
    render(() => <QuestionToolCard block={makeBlock({ status: "pending" })} agentId="agent-1" />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("shows spinner when block.input has no questions and no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock({ input: {} })} agentId="agent-1" pendingQuestions={() => []} />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });
});

describe("QuestionToolCard - interactive form (pendingQuestion present)", () => {
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

  it("shows option labels and descriptions", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
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
    const multiQuestion = {
      question: "Pick all that apply",
      header: "Multi pick",
      options: [
        { label: "Option A", description: "Desc A" },
        { label: "Option B", description: "Desc B" },
      ],
      multiple: true,
    };
    const block = makeBlock({ input: { questions: [multiQuestion] } });
    const pendingQ = makePendingQuestion({ questions: [multiQuestion] });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("always shows free-text input", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByPlaceholderText("Type your own answer")).toBeInTheDocument();
  });

  it("shows submit button", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("disables submit button when nothing selected", () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("enables submit button after selecting a radio option", async () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    screen.getAllByRole("radio")[0]?.click();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
    });
  });

  it("enables submit button after typing in text input", async () => {
    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    const textInput = screen.getByPlaceholderText("Type your own answer");
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
    screen.getAllByRole("radio")[0]?.click();
    await waitFor(() => expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled());
    screen.getByRole("button", { name: /submit/i }).click();

    await waitFor(() => {
      expect(replyMock).toHaveBeenCalledWith("test-workspace", "agent-1", "req-123", [["Red"]]);
    });
  });

  it("shows loading state while submitting", async () => {
    let resolveReply: (() => void) | undefined;
    vi.mocked(questionsApi.replyToQuestion).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReply = resolve;
        }),
    );

    render(() => (
      <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => [makePendingQuestion()]} />
    ));
    screen.getAllByRole("radio")[0]?.click();
    await waitFor(() => expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled());
    screen.getByRole("button", { name: /submit/i }).click();

    await waitFor(() => expect(document.querySelector(".animate-spin")).not.toBeNull());
    resolveReply?.();
  });
});

describe("QuestionToolCard - read-only (no pendingQuestion)", () => {
  it("shows question text from block.input when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
  });

  it("shows question header from block.input when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.getByText("Favorite color")).toBeInTheDocument();
  });

  it("shows option labels from block.input when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("does NOT show submit button when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("does NOT show free-text input when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.queryByPlaceholderText("Type your own answer")).toBeNull();
  });

  it("shows 'not answered' label when no pending question", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" pendingQuestions={() => []} />);
    expect(screen.getByText("not answered")).toBeInTheDocument();
  });

  it("shows read-only display when pendingQuestions not provided at all", () => {
    render(() => <QuestionToolCard block={makeBlock()} agentId="agent-1" />);
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("shows read-only for status=error (aborted with error)", () => {
    render(() => (
      <QuestionToolCard
        block={makeBlock({ status: "error", error: "Tool execution aborted" })}
        agentId="agent-1"
        pendingQuestions={() => []}
      />
    ));
    expect(screen.getByText("What is your favorite color?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });
});

describe("QuestionToolCard - completed state", () => {
  it("shows compact summary with JSON output", () => {
    const block = makeBlock({ status: "completed", output: JSON.stringify({ answers: [["Red"]] }) });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("shows raw output when output is not JSON", () => {
    const block = makeBlock({ status: "completed", output: "Red" });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    expect(screen.getByText("Red")).toBeInTheDocument();
  });

  it("renders without crashing when completed with no output", () => {
    const block = makeBlock({ status: "completed" });
    render(() => <QuestionToolCard block={block} agentId="agent-1" />);
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });
});

describe("QuestionToolCard - multiple questions", () => {
  it("renders all questions interactively when pending", () => {
    const questions = [
      { question: "First?", header: "Q1", options: [{ label: "Yes", description: "Yep" }], multiple: false },
      { question: "Second?", header: "Q2", options: [{ label: "Maybe", description: "Unsure" }], multiple: false },
    ];
    const block = makeBlock({ input: { questions } });
    const pendingQ = makePendingQuestion({ questions });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);

    expect(screen.getByText("First?")).toBeInTheDocument();
    expect(screen.getByText("Second?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("renders all questions read-only when not pending", () => {
    const questions = [
      { question: "First?", header: "Q1", options: [{ label: "Yes", description: "Yep" }], multiple: false },
      { question: "Second?", header: "Q2", options: [{ label: "Maybe", description: "Unsure" }], multiple: false },
    ];
    const block = makeBlock({ input: { questions } });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => []} />);

    expect(screen.getByText("First?")).toBeInTheDocument();
    expect(screen.getByText("Second?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("requires all questions answered before submit enabled", async () => {
    const questions = [
      { question: "First?", header: "Q1", options: [{ label: "Yes", description: "Yep" }], multiple: false },
      { question: "Second?", header: "Q2", options: [{ label: "Maybe", description: "Unsure" }], multiple: false },
    ];
    const block = makeBlock({ input: { questions } });
    const pendingQ = makePendingQuestion({ questions });
    render(() => <QuestionToolCard block={block} agentId="agent-1" pendingQuestions={() => [pendingQ]} />);

    // Only answer first question
    screen.getAllByRole("radio")[0]?.click();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
    });
  });
});
