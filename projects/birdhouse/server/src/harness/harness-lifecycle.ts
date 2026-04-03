// ABOUTME: Lifecycle contracts for starting, stopping, and health-checking harness runtimes.
// ABOUTME: Supports both process-backed harnesses and in-process SDK harnesses behind one interface.

export type HarnessRuntimeStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface HarnessStartOptions {
  workspaceDirectory: string;
  environment?: Record<string, string>;
}

export interface HarnessHealth {
  status: HarnessRuntimeStatus;
  details?: Record<string, unknown>;
}

export interface HarnessLifecycle<Handle = unknown> {
  start(options: HarnessStartOptions): Promise<Handle>;
  stop(): Promise<void>;
  healthcheck(): Promise<HarnessHealth>;
}
