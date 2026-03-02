// ABOUTME: Context for server runtime configuration flags
// ABOUTME: Fetches /api/config once at startup and exposes feature flags reactively

import { type Accessor, createContext, createResource, type ParentComponent, useContext } from "solid-js";
import { fetchConfig } from "../services/config-api";

interface ConfigContextValue {
  /** Whether the playground/experiments section is enabled at runtime */
  playgroundEnabled: Accessor<boolean>;
}

const ConfigContext = createContext<ConfigContextValue>();

export const ConfigProvider: ParentComponent = (props) => {
  const [config] = createResource(fetchConfig);

  const playgroundEnabled = (): boolean => config()?.playgroundEnabled ?? false;

  return <ConfigContext.Provider value={{ playgroundEnabled }}>{props.children}</ConfigContext.Provider>;
};

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used inside ConfigProvider");
  return ctx;
}
