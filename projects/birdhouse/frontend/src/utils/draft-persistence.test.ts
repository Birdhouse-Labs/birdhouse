// ABOUTME: Tests for createDebouncedSave utility
// ABOUTME: Validates debounce timing, deduplication, and flush behavior

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedSave } from "./draft-persistence";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebouncedSave", () => {
  it("fires callback after 500ms", () => {
    const callback = vi.fn();
    const { schedule } = createDebouncedSave(callback);

    schedule();
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not fire before 500ms have elapsed", () => {
    const callback = vi.fn();
    const { schedule } = createDebouncedSave(callback);

    schedule();
    vi.advanceTimersByTime(499);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("multiple schedule calls within 500ms only fire callback once", () => {
    const callback = vi.fn();
    const { schedule } = createDebouncedSave(callback);

    schedule();
    vi.advanceTimersByTime(100);
    schedule();
    vi.advanceTimersByTime(100);
    schedule();

    // Only the last timer should still be pending
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("resets the timer on each schedule call", () => {
    const callback = vi.fn();
    const { schedule } = createDebouncedSave(callback);

    schedule();
    vi.advanceTimersByTime(400);
    schedule(); // resets timer

    vi.advanceTimersByTime(400);
    // 800ms total but only 400ms since last schedule — should not have fired yet
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    // 500ms since last schedule — should fire now
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("flush cancels pending timer and calls callback immediately", () => {
    const callback = vi.fn();
    const { schedule, flush } = createDebouncedSave(callback);

    schedule();
    vi.advanceTimersByTime(200);

    flush();
    expect(callback).toHaveBeenCalledTimes(1);

    // Timer was cancelled — no second call after 500ms
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("flush when no timer pending is a no-op", () => {
    const callback = vi.fn();
    const { flush } = createDebouncedSave(callback);

    flush();
    expect(callback).not.toHaveBeenCalled();
  });

  it("schedule works again after flush", () => {
    const callback = vi.fn();
    const { schedule, flush } = createDebouncedSave(callback);

    schedule();
    flush();
    expect(callback).toHaveBeenCalledTimes(1);

    schedule();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
