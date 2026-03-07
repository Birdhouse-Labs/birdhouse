# Implementation Tree Reading Test

Read and understand a real multi-agent implementation tree created by a Birdhouse code-factory style workflow.

## Purpose

This validates whether Birdhouse read modes can help an agent understand a realistic work tree that includes:

- an orchestrator agent
- warmed-up specialist agents
- questions and approvals
- serial implementation
- handoff messages
- real code changes
- real checks

This is the strongest of the current test cases for evaluating how well Birdhouse helps an agent understand real work.

## Dataset

This test uses a specific recorded tree from an isolated Birdhouse environment.

### Root Orchestrator

- [Agents route extraction orchestrator](birdhouse:agent/agent_8DUTiraL9BTvova89O)

### Specialist Agents

- [Agent search route characterization tests](birdhouse:agent/agent_Pd-8pvtJKJBxkXMd3u)
- [Agent list-search policy extraction plan](birdhouse:agent/agent_Z0g-FEOkoRKotqWqCs)

### Scope of the Real Task

Behavior-preserving extraction of list/search policy out of `projects/birdhouse/server/src/routes/agents.ts` into:

- `projects/birdhouse/server/src/features/api/agent-list-policy.ts`
- `projects/birdhouse/server/src/features/api/get-agents.ts`
- `projects/birdhouse/server/src/features/api/search-agents.ts`

## Are Hardcoded Agent IDs OK?

Yes, for this specific test case.

- This document is not a generic prompt template.
- It is a fixed dataset meant to evaluate whether an agent can read and understand a known real tree.
- The hardcoded agent links are the point: they give a stable artifact to inspect.

The tradeoff is that this test is environment-specific. If those agents are ever deleted or become unavailable, the dataset has to be refreshed with a new real implementation tree.

## Procedure

1. Start with the orchestrator agent.
2. Read it with:
   - `agent_read({ agent_id: "agent_8DUTiraL9BTvova89O" })`
   - `agent_read({ agent_id: "agent_8DUTiraL9BTvova89O", latest_turn: true })`
   - `agent_read({ agent_id: "agent_8DUTiraL9BTvova89O", full: true })`
   - `agent_read({ agent_id: "agent_8DUTiraL9BTvova89O", all: true })`
3. Inspect both specialist agents with at least `last`, `latest_turn`, and `full`.
4. From `full`, drill into at least two tool calls with `agent_read_tool_call`:
   - one `agent_create` or `agent_reply` call from the orchestrator
   - one implementation-related tool call from a specialist
5. Compare what each mode helps you understand.

## What To Report

Report all of the following:

1. What the orchestrator was trying to accomplish
2. What each specialist owned
3. How the warm-up and approval flow worked
4. What changed in the codebase at a high level
5. What checks were run and how they affected the flow
6. What `last` reveals well
7. What `latest_turn` reveals well
8. What `full` reveals well
9. What `all` adds beyond `full`
10. What `agent_read_tool_call` adds beyond `full`
11. Whether an unfamiliar agent could understand the tree well enough to continue the work

## What Good Looks Like

A strong read of this tree should recover all of the following:

- The orchestrator first explored the task and code before any implementation.
- The orchestrator warmed up two specialist agents in parallel.
- The specialists converged on a tighter extraction scope.
- The orchestrator approved serial implementation.
- Characterization tests came first.
- Policy/handler extraction came second.
- The task was behavior-preserving rather than a broad redesign.
- Real code landed in the server feature layer and route tests.

## Notes

- This test is intentionally more realistic and noisier than the Fibonacci and read-exchange cases.
- It is the best current artifact for evaluating whether Birdhouse read modes help an agent understand a real multi-agent implementation tree.
