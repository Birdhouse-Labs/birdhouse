// ABOUTME: Vitest setup file for SolidJS testing
// ABOUTME: Configures jsdom globals and mocks browser APIs not in jsdom

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock @solidjs/router to avoid .jsx file import issues in test environment
// The router's JS files import from .jsx files which Node can't handle
vi.mock("@solidjs/router", () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => [{}, vi.fn()]),
  useLocation: vi.fn(() => ({ pathname: "/", search: "", hash: "" })),
  useMatch: vi.fn(() => undefined),
  Navigate: vi.fn(() => null),
  Route: vi.fn(() => null),
  HashRouter: vi.fn(() => null),
  Router: vi.fn(() => null),
}));

// Mock matchMedia (not available in jsdom)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock ResizeObserver (not available in jsdom)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock EventSource (not available in jsdom)
globalThis.EventSource = class EventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  readyState = 0;
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return false;
  }
} as unknown as typeof EventSource;

// Mock PointerEvent (corvu/resizable needs this)
if (typeof globalThis.PointerEvent === "undefined") {
  // @ts-expect-error - Mocking for test environment
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {};
}

// Suppress unhandled rejection errors in tests
// Many tests intentionally trigger rejections to test error handling UI
globalThis.addEventListener("unhandledrejection", (event) => {
  // Don't prevent the default - let tests see the error if they want to catch it
  // But SolidJS resources will still set resource.error properly
  event.preventDefault();
});
