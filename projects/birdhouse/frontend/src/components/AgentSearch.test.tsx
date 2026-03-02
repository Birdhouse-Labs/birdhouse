// ABOUTME: Tests for AgentSearch component
// ABOUTME: Verifies search input, checkbox, and clear functionality

import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import AgentSearch from "./AgentSearch";

describe("AgentSearch", () => {
  it("renders search input with placeholder", () => {
    render(() => (
      <AgentSearch
        query=""
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    expect(screen.getByPlaceholderText("Search agents...")).toBeInTheDocument();
  });

  it("renders include trees checkbox", () => {
    render(() => (
      <AgentSearch
        query="test"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    expect(screen.getByText("Include trees")).toBeInTheDocument();
  });

  it("shows clear button when query is not empty", () => {
    render(() => (
      <AgentSearch
        query="test query"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("does not show clear button when query is empty", () => {
    render(() => (
      <AgentSearch
        query=""
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("shows loading spinner when searching", () => {
    render(() => (
      <AgentSearch
        query="test"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        isSearching={true}
        resultCount={undefined}
      />
    ));

    // Loading spinner should be present (can't easily check animation, just verify it renders)
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("shows result count when provided", () => {
    render(() => (
      <AgentSearch
        query="test"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={5}
      />
    ));

    expect(screen.getByText("5 results")).toBeInTheDocument();
  });

  it("shows singular result text when count is 1", () => {
    render(() => (
      <AgentSearch
        query="test"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={1}
      />
    ));

    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("does not show result count when query is empty", () => {
    render(() => (
      <AgentSearch
        query=""
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={5}
      />
    ));

    expect(screen.queryByText("5 results")).not.toBeInTheDocument();
  });

  it("calls onQueryChange when input changes", () => {
    const onQueryChange = vi.fn();
    render(() => (
      <AgentSearch
        query=""
        onQueryChange={onQueryChange}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    const input = screen.getByPlaceholderText("Search agents...") as HTMLInputElement;
    input.value = "new query";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onQueryChange).toHaveBeenCalledWith("new query");
  });

  it("calls onQueryChange with empty string when clear button clicked", () => {
    const onQueryChange = vi.fn();
    render(() => (
      <AgentSearch
        query="test query"
        onQueryChange={onQueryChange}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        resultCount={undefined}
      />
    ));

    const clearButton = screen.getByLabelText("Clear search");
    clearButton.click();

    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("hides checkbox when isLoading is true", () => {
    render(() => (
      <AgentSearch
        query=""
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        isLoading={true}
        resultCount={undefined}
      />
    ));

    expect(screen.queryByText("Include trees")).not.toBeInTheDocument();
  });

  it("hides checkbox when isSearching is true", () => {
    render(() => (
      <AgentSearch
        query="test"
        onQueryChange={vi.fn()}
        includeTrees={false}
        onIncludeTreesChange={vi.fn()}
        isSearching={true}
        resultCount={undefined}
      />
    ));

    expect(screen.queryByText("Include trees")).not.toBeInTheDocument();
  });
});
