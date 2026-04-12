# How to Write a UI Test Case

## Core principle

A test case describes **what a user is trying to accomplish**, not how to click through the UI. The agent figures out the how. This makes tests resilient to UI changes — renaming a button or restructuring a page doesn't break anything.

## What belongs in a test case

**User goals** — What is the user trying to do? Frame as goals, not steps.
> ✅ "Add a Google AI provider with their API key"  
> ❌ "Click Settings, then click Workspace Settings, then click Add Provider"

**Context and setup** — What state should the world be in at the start? (Fresh install? Existing workspace? Specific API key to use?)

**What "passing" looks like** — What observable outcomes confirm the user achieved their goals? Be specific about the end state, not the path.

**What to pay attention to** — Nudge the agent toward areas where UX friction is worth observing. Don't be exhaustive — just flag the parts worth examining closely.

**Known issues to watch for** — If there are known bugs or rough edges, call them out so the agent can confirm or deny them.

**Runner-supplied placeholders** — If the flow depends on a unique workspace directory, setup URL, credential, or output artifact directory provided at run time, describe that in generic terms such as "the runner provides a fresh workspace directory". Keep the concrete URL, temp paths, timestamped run folders, and port math in the runbook, not in the test case.

## What does NOT belong

- Element indices or CSS selectors
- Step-by-step click instructions
- Expected exact text (copy changes)
- Screenshots of expected state
- Hard-coded temp paths, ports, setup URLs, or artifact output paths that belong to the test harness
- Any instruction that would break if the UI changes

## Template

```markdown
# Test Case: <Name>

## What this tests

<One sentence: what user journey or feature does this cover?>

## Starting state

<What environment does the agent start in? Fresh install? Specific data pre-loaded? What run-time inputs will the runner provide?>

## User goals

The agent should walk through this as a real user trying to:

1. <Goal 1>
2. <Goal 2>
3. <Goal 3>

## What passing looks like

- <Observable end state 1>
- <Observable end state 2>
- <The agent was able to complete the flow without needing to refresh or work around anything>

## Things to pay attention to

- <Area of UX worth examining closely>
- <Known rough edge to confirm or deny>

## Known intentional behaviours

<List things that look surprising but are by design — so the test agent doesn't flag them as issues. Examples: "OpenCode built-in models appear alongside configured provider models — this is expected." Leave this section out if there is nothing to pre-document.>

## API keys / credentials needed

<What real credentials does the agent need? These are passed in by the person running the test — not stored in the test case.>
```

## Writing good goals

- Prefer goals that reflect user intent: "launch a first agent" instead of "use the composer"
- Keep setup mechanics out of the goal: "create a workspace in the provided directory" instead of "visit `/#/setup?...`"
- If a behavior must be checked every run, make it a goal or a passing condition instead of burying it under "Things to pay attention to"
- When a third-party dependency can fail for its own reasons, define what counts as a product failure versus an environment failure

## Naming and location

Save test cases as `test-cases/<kebab-case-name>.md`.

Name them after the user journey, not the feature:
- ✅ `ftue-walk-through.md`
- ✅ `agent-launch-and-reply.md`  
- ❌ `new-agent-component.md`
- ❌ `workspace-settings-dialog.md`

## Keeping test cases current

When a test run surfaces a new issue that gets fixed, update the "Things to pay attention to" section to reflect the new baseline. Test cases are living specs — they should describe the experience as it should be, not as it once was.
