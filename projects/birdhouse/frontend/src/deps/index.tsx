// ABOUTME: Frontend dependency injection system using SolidJS Context
// ABOUTME: Provides deps context with live/test switching

import { createContext, type ParentComponent, useContext } from "solid-js";
import { createLiveEventSource, createTestEventSource, type EventSourceDep } from "../lib/event-source";

export interface FrontendDeps {
  eventSource: EventSourceDep;
}

const DepsContext = createContext<FrontendDeps>();

export function useDeps(): FrontendDeps {
  const deps = useContext(DepsContext);
  if (!deps) {
    throw new Error("useDeps must be used within DepsProvider");
  }
  return deps;
}

export function createLiveDeps(): FrontendDeps {
  return {
    eventSource: createLiveEventSource(),
  };
}

export function createTestDeps(): FrontendDeps {
  return {
    eventSource: createTestEventSource(),
  };
}

export const DepsProvider: ParentComponent<{ deps?: FrontendDeps }> = (props) => {
  const deps = props.deps ?? createLiveDeps();
  return <DepsContext.Provider value={deps}>{props.children}</DepsContext.Provider>;
};
