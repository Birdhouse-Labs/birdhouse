# Export Full Agent Tree to Markdown

Export a complete agent tree (all agents from a root) into a single combined markdown file with clickable Birdhouse links.

## Your Job

1. Get the root agent ID (user will provide it)
2. Create export directory
3. Call `birdhouse_export_tree_markdown` to export all agents at once
4. Concatenate everything with emoji banners using helper script
5. Combine with proper headers and formatting
6. Move final file to ~/Downloads
7. Clean up temporary directory
8. Report the final file location

## Step-by-Step Workflow

### 1. Create Export Directory

```bash
mkdir -p tmp/export-tree-{AGENT_ID}
```

Replace `{AGENT_ID}` with the actual root agent ID.

### 2. Export Full Tree with One Tool Call

Call `birdhouse_export_tree_markdown` to export everything at once:

```javascript
birdhouse_export_tree_markdown({
  root_agent_id: "{AGENT_ID}",
  directory: "tmp/export-tree-{AGENT_ID}"
})
```

This single tool call creates:
- `tree.md` - Formatted tree structure with clickable links
- `agent_data.txt` - Pipe-separated list (title|agent_id) in depth-first order
- `{agent_id}.md` - Individual markdown files for each agent

The tool returns information about how many agents were exported - save this for the success message!

### 3. Concatenate with Emoji Banners

Use the helper script (lives in pattern directory):

```bash
projects/birdhouse/patterns/export_agent_tree/concat-agents.sh \
  tmp/export-tree-{AGENT_ID}/agent_data.txt \
  tmp/export-tree-{AGENT_ID} \
  > tmp/export-tree-{AGENT_ID}/transcripts.md
```

This script reads the agent_data.txt file and for each agent:
- Prints an emoji banner with the agent title and link
- Appends the agent's exported markdown content

### 4. Create Final Combined File

Combine everything with proper headers and formatting:

```bash
{
  echo "# Birdhouse Agent Tree Export"
  echo ""
  echo "Birdhouse is a multi-agent orchestration platform for agentic software engineering. This export contains the complete conversation history and hierarchy for an agent tree."
  echo ""
  echo "---"
  echo ""
  echo "## Agent Tree Structure"
  echo ""
  cat tmp/export-tree-{AGENT_ID}/tree.md
  echo ""
  echo "---"
  echo ""
  cat tmp/export-tree-{AGENT_ID}/transcripts.md
} > tmp/export-tree-{AGENT_ID}/birdhouse-agent-tree-{AGENT_ID}.md
```

### 5. Move to Downloads

Move the final file to the user's Downloads directory:

```bash
mv tmp/export-tree-{AGENT_ID}/birdhouse-agent-tree-{AGENT_ID}.md ~/Downloads/
```

### 6. Clean Up

Remove the temporary export directory:

```bash
rm -rf tmp/export-tree-{AGENT_ID}
```

### 7. Report Success

Tell the user:
```
✅ Exported agent tree to: ~/Downloads/birdhouse-agent-tree-{AGENT_ID}.md

The file contains:
- Birdhouse platform description
- Agent tree with clickable links
- Full transcript for each agent with emoji banners
- {N} agents exported in depth-first order
```

Replace `{N}` with the actual count from the tool response.

## Example: Complete Workflow

```bash
# 1. Create directory
mkdir -p tmp/export-tree-agent_ABC123

# 2. Export full tree (call birdhouse_export_tree_markdown tool)
# This creates: tree.md, agent_data.txt, agent_ABC123.md, agent_DEF456.md, etc.

# 3. Concatenate with banners
projects/birdhouse/patterns/export_agent_tree/concat-agents.sh \
  tmp/export-tree-agent_ABC123/agent_data.txt \
  tmp/export-tree-agent_ABC123 \
  > tmp/export-tree-agent_ABC123/transcripts.md

# 4. Create final file with headers
{
  echo "# Birdhouse Agent Tree Export"
  echo ""
  echo "Birdhouse is a multi-agent orchestration platform for agentic software engineering. This export contains the complete conversation history and hierarchy for an agent tree."
  echo ""
  echo "---"
  echo ""
  echo "## Agent Tree Structure"
  echo ""
  cat tmp/export-tree-agent_ABC123/tree.md
  echo ""
  echo "---"
  echo ""
  cat tmp/export-tree-agent_ABC123/transcripts.md
} > tmp/export-tree-agent_ABC123/birdhouse-agent-tree-agent_ABC123.md

# 5. Move to Downloads
mv tmp/export-tree-agent_ABC123/birdhouse-agent-tree-agent_ABC123.md ~/Downloads/

# 6. Clean up temporary directory
rm -rf tmp/export-tree-agent_ABC123
```

## Output Format

The final file structure in `~/Downloads/birdhouse-agent-tree-{AGENT_ID}.md`:

```markdown
# Birdhouse Agent Tree Export

Birdhouse is a multi-agent orchestration platform for agentic software engineering. This export contains the complete conversation history and hierarchy for an agent tree.

---

## Agent Tree Structure

- [Root Agent](birdhouse:agent/agent_XXX) **L0** `model`
  - [Child](birdhouse:agent/agent_YYY) **L1** `model`

---

🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖
# 🤖 [Root Agent](birdhouse:agent/agent_XXX) 🤖
🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖

[agent_XXX markdown export content]


🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖
# 🤖 [Child](birdhouse:agent/agent_YYY) 🤖
🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖🤖

[agent_YYY markdown export content]
```

## Tools You'll Use

- `birdhouse_export_tree_markdown(root_agent_id, directory)` - Export complete tree with one call
- Bash - File concatenation and manipulation
- Helper script: `projects/birdhouse/patterns/export_agent_tree/concat-agents.sh`
