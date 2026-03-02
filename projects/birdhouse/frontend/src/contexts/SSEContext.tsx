// ABOUTME: SSE event distribution via SolidJS Context + Store
// ABOUTME: Single EventSource connection, reactive updates to all subscribers

import { createContext, onCleanup, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import { useDeps } from "../deps";
import { log } from "../lib/logger";

// Event types from server
export interface SSEEvent {
  type: string;
  session?: { id: string; title: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface SSEStore {
  connected: boolean;
  error: string | null;
  latestEvent: SSEEvent | null;
  events: SSEEvent[];
}

interface SSEContextValue {
  store: SSEStore;
}

const SSEContext = createContext<SSEContextValue>();

export function useSSE(): SSEContextValue {
  const ctx = useContext(SSEContext);
  if (!ctx) {
    throw new Error("useSSE must be used within SSEProvider");
  }
  return ctx;
}

export const SSEProvider: ParentComponent = (props) => {
  const { eventSource } = useDeps();

  const [store, setStore] = createStore<SSEStore>({
    connected: false,
    error: null,
    latestEvent: null,
    events: [],
  });

  const es = eventSource.create("/api/events");

  es.onopen = () => {
    setStore("connected", true);
    setStore("error", null);
  };

  es.onerror = () => {
    setStore("connected", false);
    setStore("error", "Connection failed");
  };

  es.onmessage = (event) => {
    try {
      const parsed: SSEEvent = JSON.parse(event.data);
      setStore("latestEvent", parsed);
      setStore("events", (prev) => {
        const newEvents = [...prev, parsed];
        return newEvents.length > 100 ? newEvents.slice(-100) : newEvents;
      });
    } catch (e) {
      log.api.error("Failed to parse SSE event", {}, e);
    }
  };

  onCleanup(() => {
    es.close();
  });

  return <SSEContext.Provider value={{ store }}>{props.children}</SSEContext.Provider>;
};
