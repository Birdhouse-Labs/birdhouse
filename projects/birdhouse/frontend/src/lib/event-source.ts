// ABOUTME: EventSource dependency with live and test implementations
// ABOUTME: Provides SSE connection abstraction for dependency injection

export interface EventSourceDep {
  create: (url: string) => EventSource;
}

export function createLiveEventSource(): EventSourceDep {
  return {
    create: (url: string) => new EventSource(url),
  };
}

// Test implementation with mock control
export interface MockEventSourceInstance {
  url: string;
  onopen: (() => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((error: Event) => void) | null;
  close: () => void;
  simulateOpen: () => void;
  simulateMessage: (data: unknown) => void;
  simulateError: () => void;
}

let mockInstance: MockEventSourceInstance | null = null;

export function createTestEventSource(): EventSourceDep {
  return {
    create: (url: string) => {
      mockInstance = {
        url,
        onopen: null,
        onmessage: null,
        onerror: null,
        close: () => {},
        simulateOpen() {
          this.onopen?.();
        },
        simulateMessage(data) {
          this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
        },
        simulateError() {
          this.onerror?.(new Event("error"));
        },
      };
      return mockInstance as unknown as EventSource;
    },
  };
}

export function getMockEventSource(): MockEventSourceInstance | null {
  return mockInstance;
}

export function resetMockEventSource(): void {
  mockInstance = null;
}
