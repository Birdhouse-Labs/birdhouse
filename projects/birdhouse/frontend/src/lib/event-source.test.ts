// ABOUTME: Unit tests for EventSource dependency injection
// ABOUTME: Tests live and mock implementations

import { beforeEach, describe, expect, it } from "vitest";
import { createLiveEventSource, createTestEventSource, getMockEventSource, resetMockEventSource } from "./event-source";

describe("createLiveEventSource", () => {
  it("creates EventSource with correct URL", () => {
    const dep = createLiveEventSource();
    const es = dep.create("/test-url");
    expect(es).toBeInstanceOf(EventSource);
    expect(es.url).toContain("/test-url");
    es.close();
  });
});

describe("createTestEventSource", () => {
  beforeEach(() => {
    resetMockEventSource();
  });

  it("creates mock EventSource with correct URL", () => {
    const dep = createTestEventSource();
    const es = dep.create("/test-url");
    expect(es.url).toBe("/test-url");
  });

  it("stores mock instance for retrieval", () => {
    const dep = createTestEventSource();
    dep.create("/test-url");
    const mock = getMockEventSource();
    expect(mock).not.toBeNull();
    expect(mock?.url).toBe("/test-url");
  });

  it("calls onopen when simulateOpen is called", () => {
    const dep = createTestEventSource();
    const es = dep.create("/test");
    let opened = false;
    es.onopen = () => {
      opened = true;
    };
    const mock = getMockEventSource();
    mock?.simulateOpen();
    expect(opened).toBe(true);
  });

  it("calls onmessage with parsed data when simulateMessage is called", () => {
    const dep = createTestEventSource();
    const es = dep.create("/test");
    let receivedData: unknown = null;
    es.onmessage = (event) => {
      receivedData = JSON.parse(event.data);
    };
    const mock = getMockEventSource();
    const testData = { type: "test", value: 42 };
    mock?.simulateMessage(testData);
    expect(receivedData).toEqual(testData);
  });

  it("calls onerror when simulateError is called", () => {
    const dep = createTestEventSource();
    const es = dep.create("/test");
    let errorOccurred = false;
    es.onerror = () => {
      errorOccurred = true;
    };
    const mock = getMockEventSource();
    mock?.simulateError();
    expect(errorOccurred).toBe(true);
  });

  it("can be closed without throwing", () => {
    const dep = createTestEventSource();
    const es = dep.create("/test");
    expect(() => es.close()).not.toThrow();
  });

  it("resets mock instance when resetMockEventSource is called", () => {
    const dep = createTestEventSource();
    dep.create("/test");
    expect(getMockEventSource()).not.toBeNull();
    resetMockEventSource();
    expect(getMockEventSource()).toBeNull();
  });

  it("replaces previous mock instance on new create", () => {
    const dep = createTestEventSource();
    dep.create("/first");
    const firstMock = getMockEventSource();
    dep.create("/second");
    const secondMock = getMockEventSource();
    expect(firstMock).not.toBe(secondMock);
    expect(secondMock?.url).toBe("/second");
  });
});
