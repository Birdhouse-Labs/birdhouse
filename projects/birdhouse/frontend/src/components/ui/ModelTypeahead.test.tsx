// ABOUTME: Tests for ModelTypeahead trigger detection and model filtering logic.
// ABOUTME: Covers @@@ trigger recognition, query extraction, and collision with @@ and @.

import { describe, expect, it } from "vitest";
import { findModelTrigger } from "./ModelTypeahead";

describe("findModelTrigger", () => {
  const cursor = (text: string) => text.length;

  it("returns found=false when input has no @@@", () => {
    const text = "hello world";
    expect(findModelTrigger(text, cursor(text)).found).toBe(false);
  });

  it("returns found=false for single @", () => {
    const text = "@file";
    expect(findModelTrigger(text, cursor(text)).found).toBe(false);
  });

  it("returns found=false for @@", () => {
    const text = "@@agent";
    expect(findModelTrigger(text, cursor(text)).found).toBe(false);
  });

  it("detects @@@ with no query typed yet", () => {
    const text = "@@@";
    const result = findModelTrigger(text, cursor(text));
    expect(result.found).toBe(true);
    expect(result.query).toBe("");
    expect(result.startIndex).toBe(0);
  });

  it("detects @@@ with a partial query", () => {
    const text = "@@@claude";
    const result = findModelTrigger(text, cursor(text));
    expect(result.found).toBe(true);
    expect(result.query).toBe("claude");
    expect(result.startIndex).toBe(0);
  });

  it("detects @@@ mid-sentence", () => {
    const text = "use @@@sonnet for this";
    // cursor positioned right after "sonnet" (before space)
    const pos = text.indexOf("sonnet") + "sonnet".length;
    const result = findModelTrigger(text, pos);
    expect(result.found).toBe(true);
    expect(result.query).toBe("sonnet");
    expect(result.startIndex).toBe(text.indexOf("@@@"));
  });

  it("stops at whitespace - does not match across word boundary", () => {
    // cursor is on the word after the space, not near @@@
    const text = "@@@claude sonnet";
    const pos = cursor(text);
    const result = findModelTrigger(text, pos);
    // cursor is past whitespace - should not find trigger
    expect(result.found).toBe(false);
  });

  it("cursor positioned right after @@@ with query before space", () => {
    const text = "@@@claude-3";
    const result = findModelTrigger(text, cursor(text));
    expect(result.found).toBe(true);
    expect(result.query).toBe("claude-3");
  });

  it("does not fire when cursor is before @@@", () => {
    const text = "@@@claude";
    // cursor at position 0 (before any @@)
    expect(findModelTrigger(text, 0).found).toBe(false);
  });

  it("returns the correct matchedText including @@@", () => {
    const text = "@@@anth";
    const result = findModelTrigger(text, cursor(text));
    expect(result.found).toBe(true);
    expect(result.matchedText).toBe("@@@anth");
  });

  it("handles @@@ at end of longer text with @@ earlier", () => {
    const text = "check @@someagent and @@@claude";
    const result = findModelTrigger(text, cursor(text));
    expect(result.found).toBe(true);
    expect(result.query).toBe("claude");
    expect(result.startIndex).toBe(text.indexOf("@@@"));
  });
});
