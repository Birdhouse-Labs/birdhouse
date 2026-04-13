// ABOUTME: Tool registration contracts for exposing Birdhouse tools to different harness runtimes.
// ABOUTME: Keeps harness-specific registration details outside the core Birdhouse tool definitions.

export interface BirdhouseToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
  execute(input: unknown): Promise<unknown> | unknown;
}

export interface ToolRegistrationOptions {
  workspaceDirectory: string;
  tools: BirdhouseToolDefinition[];
}

export interface ToolRegistrar<Registration = unknown> {
  registerTools(options: ToolRegistrationOptions): Promise<Registration> | Registration;
}
