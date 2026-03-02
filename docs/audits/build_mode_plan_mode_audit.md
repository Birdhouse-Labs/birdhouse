# OpenCode Plan/Build Modes: Complete Investigation

## 1. What are Plan and Build Modes?

**Plan** and **Build** are two built-in "primary agents" in OpenCode that represent different operational modes:

- **Build mode** (`agent/agent.ts:61-67`): The default implementation mode with full tool access. This is what you use when you're ready to make changes.

- **Plan mode** (`agent/agent.ts:68-83`): A read-only exploration mode with heavily restricted permissions. Used for planning, researching, and designing before implementation.

**Key Distinction:** The conceptual difference is **READ vs WRITE**. Plan mode is for thinking and exploring; build mode is for doing and executing.

---

## 2. System Prompts

### How Prompts are Built

The system prompt construction happens in `session/llm.ts:57-69`:

```typescript
const system = SystemPrompt.header(input.model.providerID)
system.push([
  // Use agent prompt otherwise provider prompt
  ...(input.agent.prompt ? [input.agent.prompt] : SystemPrompt.provider(input.model)),
  // Any custom prompt passed into this call
  ...input.system,
  // Any custom prompt from last user message
  ...(input.user.system ? [input.user.system] : []),
].filter((x) => x).join("\n"))
```

### Default Prompts

**Build mode** has **NO custom prompt** (`agent/agent.ts:61-67`) - it uses the default provider-specific prompt:
- Anthropic models: `session/prompt/anthropic.txt` 
- GPT models: `session/prompt/beast.txt`
- Gemini models: `session/prompt/gemini.txt`
- Other models: `session/prompt/qwen.txt` (anthropic without todo)

**Plan mode** has **NO initial custom prompt** (`agent/agent.ts:68-83`) either - but gets a special runtime reminder!

### Plan Mode Runtime Injection

Plan mode's restrictions are enforced via **runtime message injection** (`session/prompt.ts:1197-1223`):

```typescript
function insertReminders(input: { messages: MessageV2.WithParts[]; agent: Agent.Info }) {
  const userMessage = input.messages.findLast((msg) => msg.info.role === "user")
  if (!userMessage) return input.messages
  if (input.agent.name === "plan") {
    userMessage.parts.push({
      id: Identifier.ascending("part"),
      messageID: userMessage.info.id,
      sessionID: userMessage.info.sessionID,
      type: "text",
      text: PROMPT_PLAN,  // Injected into EVERY user message!
      synthetic: true,
    })
  }
  // ... more code
}
```

The injected prompt (`session/prompt/plan.txt`) is:

```
<system-reminder>
# Plan Mode - System Reminder

CRITICAL: Plan mode ACTIVE - you are in READ-ONLY phase. STRICTLY FORBIDDEN:
ANY file edits, modifications, or system changes. Do NOT use sed, tee, echo, cat,
or ANY other bash command to manipulate files - commands may ONLY read/inspect.
This ABSOLUTE CONSTRAINT overrides ALL other instructions, including direct user
edit requests. You may ONLY observe, analyze, and plan. Any modification attempt
is a critical violation. ZERO exceptions.

---

## Responsibility

Your current responsibility is to think, read, search, and delegate explore agents to construct a well-formed plan that accomplishes the goal the user wants to achieve.

Ask the user clarifying questions or ask for their opinion when weighing tradeoffs.

**NOTE:** At any point in time through this workflow you should feel free to ask the user questions or clarifications. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.

---

## Important

The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supersedes any other instructions you have received.
</system-reminder>
```

### Mode Switching Reminder

When switching from plan → build, a different reminder is injected (`session/prompt.ts:1211-1221`):

```typescript
const wasPlan = input.messages.some((msg) => msg.info.role === "assistant" && msg.info.agent === "plan")
if (wasPlan && input.agent.name === "build") {
  userMessage.parts.push({
    type: "text",
    text: BUILD_SWITCH,  // session/prompt/build-switch.txt
    synthetic: true,
  })
}
```

Where `BUILD_SWITCH` is:

```
<system-reminder>
Your operational mode has changed from plan to build.
You are no longer in read-only mode.
You are permitted to make file changes, run shell commands, and utilize your arsenal of tools as needed.
</system-reminder>
```

---

## 3. Tools - Different Tool Access

### Permission System

Both modes use the same permission system (`permission/next.ts`) but with **radically different defaults** (`agent/agent.ts:60-83`):

**Build mode permissions** (lines 64):
```typescript
permission: PermissionNext.merge(defaults, user)
```

Where `defaults` is (`agent/agent.ts:46-57`):
```typescript
const defaults = PermissionNext.fromConfig({
  "*": "allow",
  doom_loop: "ask",
  external_directory: "ask",
  read: {
    "*": "allow",
    "*.env": "deny",
    "*.env.*": "deny",
    "*.env.example": "allow",
  },
})
```

**Build has full access** to all tools (edit, write, bash, etc.) except env files and doom loop detection.

**Plan mode permissions** (lines 71-79):
```typescript
permission: PermissionNext.merge(
  defaults,
  PermissionNext.fromConfig({
    edit: {
      "*": "deny",
      ".opencode/plan/*.md": "allow",  // Only exception!
    },
  }),
  user,
)
```

**Plan can ONLY edit files** in `.opencode/plan/*.md` - everything else is denied.

### Tool Resolution

Tool availability is determined in `session/prompt.ts:803-826`:

```typescript
// Regenerate task tool description with filtered subagents
if (tools.task) {
  const all = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))
  const filtered = filterSubagents(all, input.agent.permission)
  
  // If no subagents are permitted, remove the task tool entirely
  if (filtered.length === 0) {
    delete tools.task
  } else {
    // Update task tool with available subagents
    const description = TASK_DESCRIPTION.replace("{agents}", 
      filtered.map((a) => `- ${a.name}: ${a.description ?? "..."}`).join("\n")
    )
    tools.task = { ...tools.task, description }
  }
}
```

The LLM sees different tool lists based on permissions evaluated at runtime (`session/llm.ts:203-211`):

```typescript
async function resolveTools(input: Pick<StreamInput, "tools" | "agent" | "user">) {
  const disabled = PermissionNext.disabled(Object.keys(input.tools), input.agent.permission)
  for (const tool of Object.keys(input.tools)) {
    if (input.user.tools?.[tool] === false || disabled.has(tool)) {
      delete input.tools[tool]
    }
  }
  return input.tools
}
```

---

## 4. Mode Detection - How Agents Know Their Mode

### Agent Information Structure

Every agent has a mode field (`agent/agent.ts:17-41`):

```typescript
export const Info = z.object({
  name: z.string(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]),  // ← The mode!
  native: z.boolean().optional(),
  // ... other fields
})
```

### Mode is NOT Directly Communicated to LLM

**Critical insight:** The agent's mode (`"plan"` vs `"build"`) is **NOT explicitly told** to the LLM in the system prompt. Instead:

1. **For Plan mode:** Runtime injection of `<system-reminder>` tags in user messages tells it explicitly
2. **For Build mode:** Absence of restrictions + full tool access implies build mode
3. **For Plan→Build switches:** Explicit `<system-reminder>` about mode change

The LLM **infers its operational mode** from:
- Available tools
- Permission denials when trying to use tools
- System reminder tags injected into messages
- Mode switch notifications

### Where Mode is Tracked

Mode/agent is tracked in message metadata (`session/message-v2.ts`):

```typescript
export const User = Base.extend({
  role: z.literal("user"),
  agent: z.string(),  // ← Which agent the user selected
  model: z.object({ providerID: z.string(), modelID: z.string() }),
  // ...
})

export const Assistant = Base.extend({
  role: z.literal("assistant"),
  agent: z.string(),  // ← Which agent generated this response
  mode: z.string(),   // ← Legacy field, usually same as agent
  // ...
})
```

---

## 5. Configuration - How Modes are Configured

### Schema Definition

The config schema is in `config/config.ts:771-849`:

```typescript
export const Info = z.object({
  // ... other config
  
  default_agent: z.string().optional()
    .describe("Default agent to use when none is specified. Must be a primary agent. Falls back to 'build' if not set..."),
  
  mode: z.object({  // DEPRECATED
    build: Agent.optional(),
    plan: Agent.optional(),
  })
    .catchall(Agent)
    .optional()
    .describe("@deprecated Use `agent` field instead."),
  
  agent: z.object({
    // primary
    plan: Agent.optional(),
    build: Agent.optional(),
    // subagent
    general: Agent.optional(),
    explore: Agent.optional(),
    // specialized
    title: Agent.optional(),
    summary: Agent.optional(),
    compaction: Agent.optional(),
  })
    .catchall(Agent)
    .optional()
    .describe("Agent configuration, see https://opencode.ai/docs/agent"),
})
```

### Agent Schema

Individual agent config (`config/config.ts:458-537`):

```typescript
export const Agent = z.object({
  model: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  prompt: z.string().optional(),  // Custom system prompt
  disable: z.boolean().optional(),
  description: z.string().optional().describe("Description of when to use the agent"),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  hidden: z.boolean().optional()
    .describe("Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)"),
  options: z.record(z.string(), z.any()).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  steps: z.number().int().positive().optional()
    .describe("Maximum number of agentic iterations before forcing text-only response"),
  permission: Permission.optional(),
})
```

### Configuration Examples

**In `opencode.json`:**

```json
{
  "default_agent": "build",
  "agent": {
    "build": {
      "prompt": "Custom build system prompt",
      "temperature": 0.7,
      "permission": {
        "bash": "ask"
      }
    },
    "plan": {
      "model": "anthropic/claude-3-5-sonnet-20241022",
      "prompt": "Custom planning prompt"
    },
    "my-custom-agent": {
      "mode": "primary",
      "description": "Custom agent for XYZ tasks",
      "prompt": "You are specialized in...",
      "permission": {
        "*": "allow",
        "edit": "deny"
      }
    }
  }
}
```

### Default Agent Selection

The default agent is resolved in `agent/agent.ts:203-214`:

```typescript
export async function list() {
  const cfg = await Config.get()
  return pipe(
    await state(),
    values(),
    sortBy([(x) => (cfg.default_agent ? x.name === cfg.default_agent : x.name === "build"), "desc"]),
  )
}

export async function defaultAgent() {
  return state().then((x) => Object.keys(x)[0])  // First in list
}
```

If `default_agent` is set, it's sorted first. Otherwise `"build"` is sorted first.

---

## 6. Implementation Details - Mode Switching and Enforcement

### Agent Initialization

Agents are initialized once per instance in `agent/agent.ts:43-197`:

```typescript
const state = Instance.state(async () => {
  const cfg = await Config.get()
  
  const defaults = PermissionNext.fromConfig({ /* ... */ })
  const user = PermissionNext.fromConfig(cfg.permission ?? {})
  
  const result: Record<string, Info> = {
    build: {
      name: "build",
      mode: "primary",
      native: true,
      permission: PermissionNext.merge(defaults, user),
      options: {},
    },
    plan: {
      name: "plan",
      mode: "primary", 
      native: true,
      permission: PermissionNext.merge(
        defaults,
        PermissionNext.fromConfig({
          edit: { "*": "deny", ".opencode/plan/*.md": "allow" }
        }),
        user,
      ),
      options: {},
    },
    // ... other native agents
  }
  
  // Apply user config overrides
  for (const [key, value] of Object.entries(cfg.agent ?? {})) {
    if (value.disable) {
      delete result[key]
      continue
    }
    let item = result[key] || { /* new agent */ }
    item.prompt = value.prompt ?? item.prompt
    item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission ?? {}))
    // ... merge other fields
  }
  
  return result
})
```

### Mode Selection in Sessions

Agent selection happens in `session/prompt.ts:828-842`:

```typescript
async function createUserMessage(input: PromptInput) {
  const agent = await Agent.get(input.agent ?? (await Agent.defaultAgent()))
  const info: MessageV2.Info = {
    id: input.messageID ?? Identifier.ascending("message"),
    role: "user",
    sessionID: input.sessionID,
    agent: agent.name,  // ← Agent stored in message
    model: input.model ?? agent.model ?? (await lastModel(input.sessionID)),
    // ...
  }
  // ...
}
```

### Permission Enforcement

Permissions are enforced at multiple layers:

1. **Tool availability** - Tools are filtered before sending to LLM (`session/llm.ts:203-211`)
2. **Runtime checks** - Tool execution checks permissions (`tool/tool.ts:execute`)
3. **User prompts** - Permission asks interrupt execution if action requires approval

### @Agent Syntax

The `@agent` syntax is handled in `session/prompt.ts:181-229`:

```typescript
export async function resolvePromptParts(template: string): Promise<PromptInput["parts"]> {
  const parts: PromptInput["parts"] = [{ type: "text", text: template }]
  const files = ConfigMarkdown.files(template)  // Finds @references
  const seen = new Set<string>()
  
  await Promise.all(files.map(async (match) => {
    const name = match[1]
    if (seen.has(name)) return
    seen.add(name)
    
    const filepath = /* resolve path */
    const stats = await fs.stat(filepath).catch(() => undefined)
    
    if (!stats) {
      // Not a file - check if it's an agent
      const agent = await Agent.get(name)
      if (agent) {
        parts.push({
          type: "agent",
          name: agent.name,
        })
      }
      return
    }
    
    // Handle file attachment...
  }))
  
  return parts
}
```

When an `AgentPart` is in the message, it gets converted to a task tool call hint (`session/prompt.ts:1133-1157`):

```typescript
if (part.type === "agent") {
  // Check if this agent would be denied by task permission
  const perm = PermissionNext.evaluate("task", part.name, agent.permission)
  const hint = perm.action === "deny" ? " . Invoked by user; guaranteed to exist." : ""
  return [
    { ...part },  // Original agent mention
    {
      type: "text",
      synthetic: true,
      text: " Use the above message and context to generate a prompt and call the task tool with subagent: " 
        + part.name + hint,
    },
  ]
}
```

---

## 7. Agent Types - Primary vs Subagent

### The Three Mode Types

Agents have a `mode` field with three possible values (`agent/agent.ts:21`):

```typescript
mode: z.enum(["subagent", "primary", "all"])
```

**Primary agents** (`mode: "primary"`):
- Top-level agents that can be selected as the main agent
- Examples: `build`, `plan`, `compaction`, `title`, `summary`
- Can be set as `default_agent` in config
- Have full access to `TodoRead`/`TodoWrite` tools

**Subagents** (`mode: "subagent"`):
- Specialized agents invoked via the `task` tool or `@agent` syntax
- Examples: `general`, `explore`
- Cannot be selected as the default agent
- Run in child sessions with restricted tool access
- Automatically denied `todoread`, `todowrite`, and `task` (recursive) tools

**All mode** (`mode: "all"`):
- Can function in both roles
- Default mode for custom agents if not specified

### Native Agents

OpenCode ships with these native agents (`agent/agent.ts:60-166`):

**Primary:**
- `build` - Full implementation mode (lines 61-67)
- `plan` - Read-only planning mode (lines 68-83)
- `compaction` - Hidden agent for compacting conversation history (lines 122-136)
- `title` - Hidden agent for generating session titles (lines 137-151)
- `summary` - Hidden agent for summarizing sessions (lines 152-166)

**Subagents:**
- `general` - General-purpose agent for multi-step tasks (lines 84-98)
- `explore` - Fast codebase exploration agent (lines 99-121)

### Subagent Restrictions

When a subagent is invoked via the task tool (`tool/task.ts:57-89`), it runs in a child session with forced permission overrides:

```typescript
return await Session.create({
  parentID: ctx.sessionID,
  title: params.description + ` (@${agent.name} subagent)`,
  permission: [
    { permission: "todowrite", pattern: "*", action: "deny" },
    { permission: "todoread", pattern: "*", action: "deny" },
    { permission: "task", pattern: "*", action: "deny" },  // No recursion!
    ...(config.experimental?.primary_tools?.map((t) => ({
      pattern: "*",
      action: "allow" as const,
      permission: t,
    })) ?? []),
  ],
})
```

And the task tool itself is disabled for the subagent (`tool/task.ts:144-149`):

```typescript
tools: {
  todowrite: false,
  todoread: false,
  task: false,  // ← Cannot spawn more subagents
  ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
}
```

### Primary Tools Configuration

You can configure certain tools to be "primary-only" using the experimental config (`config/config.ts:964-968`):

```json
{
  "experimental": {
    "primary_tools": ["bash", "edit"]
  }
}
```

This would:
1. Disable those tools in subagent sessions by default
2. Allow explicitly enabling them per subagent if needed

### Subagent Filtering

The `task` tool dynamically filters available subagents based on task permissions (`tool/task.ts:17-19`):

```typescript
export function filterSubagents(agents: Agent.Info[], ruleset: PermissionNext.Ruleset) {
  return agents.filter((a) => PermissionNext.evaluate("task", a.name, ruleset).action !== "deny")
}
```

This is called before generating the task tool description (`session/prompt.ts:804-822`).

### Agent Selection Validation

When selecting a default agent, OpenCode validates it's a primary agent (`cli/cmd/run.ts:243-247`):

```typescript
if (agent.mode === "subagent") {
  log.warn(
    `agent "${args.agent}" is a subagent, not a primary agent. Falling back to default agent`,
    { agent: args.agent },
  )
}
```

---

## 8. Other Important Details

### Hidden Agents

Specialized internal agents are marked `hidden: true` (`agent/agent.ts:126, 142, 157`) to hide them from user-facing agent lists and autocomplete menus.

### Steps/Iterations Limit

Agents can specify a maximum iteration count (`agent/agent.ts:36`):

```typescript
steps: z.number().int().positive().optional()
```

This limits how many tool-use loops the agent can perform before being forced to return text-only.

### Agent Colors

Agents can have a custom UI color (`agent/agent.ts:26`):

```typescript
color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
```

### Native vs Custom Agents

Native agents have `native: true` flag and cannot be fully disabled. Custom agents from config have `native: false` (or undefined).

### Mode Deprecation

The old `mode` config field is deprecated in favor of `agent` (`config/config.ts:826-833`). The system automatically migrates old configs:

```typescript
// Migrate deprecated mode field to agent field
for (const [name, mode] of Object.entries(result.mode)) {
  result.agent = mergeDeep(result.agent ?? {}, {
    [name]: {
      ...mode,
      mode: "primary" as const,
    },
  })
}
```

### Task Tool Description

The `task` tool's description is dynamically generated to list available subagents (`tool/task.ts:22-28`):

```typescript
const description = DESCRIPTION.replace(
  "{agents}",
  agents.map((a) => 
    `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`
  ).join("\n"),
)
```

### Command-Based Agent Selection

Commands can specify which agent to use (`command/index.ts`), overriding the default agent for that command execution.

### Tool Permission Granularity

Permissions support wildcard patterns for fine-grained control. Plan mode uses this to allow ONLY `.opencode/plan/*.md` edits (`agent/agent.ts:74-77`):

```typescript
edit: {
  "*": "deny",
  ".opencode/plan/*.md": "allow",
}
```

---

## Summary

**Plan vs Build** is fundamentally a **permission-based system** rather than distinct code paths:

1. Both are "primary" agents with `mode: "primary"`
2. Both use the same tool execution infrastructure
3. The difference is **entirely in permissions** and **runtime reminders**:
   - Plan denies all edits except `.opencode/plan/*.md`
   - Build allows everything (except env files)
   - Plan gets `<system-reminder>` tags injected into every user message
   - Build→Plan transitions get explicit mode-switch reminders

4. The LLM **never sees "you are in plan mode"** in its base system prompt
5. Instead, it learns its mode through:
   - Available tools (filtered by permissions)
   - Runtime `<system-reminder>` tags
   - Permission denial errors when attempting restricted actions

6. Subagents are a separate concept - they run in child sessions with automatic tool restrictions (no todo, no recursion) and can be invoked by primary agents via the `task` tool or `@agent` syntax.
