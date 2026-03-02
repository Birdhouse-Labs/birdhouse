# Birdhouse OpenCode Plugin

OpenCode plugin that exposes agent management tools for Birdhouse.

## Tools

### agent_create
Create a new AI agent with a prompt. The new agent automatically becomes a child of the current agent.

**Parameters:**
- `prompt` (required) - Task prompt for the agent
- `title` (optional) - Agent title (auto-generated if not provided)
- `model` (optional) - Model to use (defaults to source agent's model when cloning, or parent agent's model)
- `wait` (optional) - Wait for completion (default: `true`). Set to `false` for async.

### agent_read
Read an agent's messages as raw JSON. By default, waits for the agent to complete before returning.

**Parameters:**
- `agent_id` (required) - Agent ID to read from
- `skip_wait` (optional) - Skip waiting and return immediately (default: `false`)
- `latest_turn` (optional) - Get all messages since last user message (default: `false`)
- `all` (optional) - Get entire conversation (default: `false`)

### agent_reply
Send a follow-up message to an existing agent to continue the conversation.

**Parameters:**
- `agent_id` (required) - Agent ID to send message to
- `message` (required) - Follow-up message or feedback
- `wait` (optional) - Wait for agent's response (default: `true`)

### birdhouse_export_agent_markdown
Export a single agent's timeline as markdown and save to a file. Returns the file path where the markdown was written.

**Parameters:**
- `agent_id` (required) - Agent ID to export
- `directory` (required) - Directory where file should be written
  - Absolute paths: `/Users/name/Downloads`
  - Relative paths (to workspace): `.`, `tmp/exports`

**Use case:** Share agent conversations with humans for review, documentation, or archival.

### birdhouse_agent_tree
Get the formatted tree structure for any agent ID. Returns markdown-formatted tree showing hierarchy.

**Parameters:**
- `agent_id` (required) - Agent ID to get tree for (the root of the tree)

**Returns:** Markdown-formatted tree with agent links, levels, and models.

**Use cases:**
- Explore another agent's tree hierarchy
- Analyze tree structures before exporting
- Implement multi-agent export patterns
- Document complex agent workflows

### birdhouse_export_tree_markdown
Export an entire agent tree (all agents from a root) in a single call. Replaces 28+ tool calls with 1.

**Parameters:**
- `root_agent_id` (required) - Root agent of tree to export
- `directory` (required) - Where to write output files (absolute or relative)

**Output files:**
- `tree.md` - Formatted tree structure with clickable links
- `agent_data.txt` - Pipe-separated list for concatenation scripts
- `{agent_id}.md` - Individual agent markdown files (one per agent)

**Use case:** Export multi-agent conversation trees for archival, documentation, or sharing. Dramatically faster than exporting agents individually.

## Installation (Local Development)

In your OpenCode config:

```json
{
  "plugin": ["file:///Users/crayment/dev/birdhouse/projects/birdhouse-oc-plugin"]
}
```

## Usage Examples

```javascript
// Create and wait (default)
agent_create({ 
  prompt: "Research React hooks best practices"
})

// Create async (fire-and-forget)
agent_create({ 
  prompt: "Long research task",
  wait: false 
})

// Read (waits by default)
agent_read({ agent_id: "agent_abc123" })

// Read without waiting
agent_read({ agent_id: "agent_abc123", skip_wait: true })

// Read full turn
agent_read({ agent_id: "agent_abc123", latest_turn: true })

// Reply
agent_reply({ 
  agent_id: "agent_abc123",
  message: "Can you elaborate on point 2?"
})

// Export to workspace
birdhouse_export_agent_markdown({
  agent_id: "agent_abc123",
  directory: "."
})

// Export to Downloads
birdhouse_export_agent_markdown({
  agent_id: "agent_abc123",
  directory: "/Users/name/Downloads"
})

// Get tree structure for any agent
birdhouse_agent_tree({
  agent_id: "agent_abc123"
})

// Export entire tree in one call (replaces 28+ individual exports!)
birdhouse_export_tree_markdown({
  root_agent_id: "agent_root",
  directory: "tmp/tree-exports"
})

// Export tree to Downloads
birdhouse_export_tree_markdown({
  root_agent_id: "agent_root",
  directory: "/Users/name/Downloads/my-project-export"
})
```

## Configuration

**REQUIRED:** Set `BIRDHOUSE_SERVER` environment variable when starting OpenCode.

Example:
```bash
export BIRDHOUSE_SERVER=http://localhost:50121
opencode
```

There is no default value - the plugin will fail fast with a clear error if this is not set.

## Development

```bash
npm install
npm run dev    # Watch mode (auto-rebuilds on changes)
npm run build  # Production build
```

## Architecture

This plugin is a **thin wrapper** around the Birdhouse `/aapi/` API:
- All complex logic (filtering, selection, waiting) lives on the Birdhouse server
- Plugin just translates tool calls to API requests
- Server handles message filtering, mode selection, and completion waiting
