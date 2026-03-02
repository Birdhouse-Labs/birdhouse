# AAPI Agent Creation Refactor: Two-Step Creation

## Problem

When `POST /aapi/agents` creates an agent with `wait=true` (default), it:
1. Creates the agent in the database (gets `agent_id`)
2. Sends first message and waits for completion (can timeout after ~5 mins)
3. Returns response with agent data + results

If step 2 times out at the HTTP/fetch level, the entire request fails and the client never receives the `agent_id`, even though the agent was successfully created.

This makes timeout error messages unhelpful - they can't tell users which agent ID to use for recovery.

## Solution

Refactor `/aapi/agents` to separate creation from waiting:

### Option A: Two-step API
1. **POST /aapi/agents** - Create agent, return `agent_id` immediately
2. **POST /aapi/agents/:id/wait** - Wait for first message completion (optional)

### Option B: Streaming Response
1. Return `agent_id` in initial response chunk
2. Stream completion status/results in subsequent chunks
3. Client gets agent_id even if stream times out

### Option C: Async-First Design
1. `wait=true` returns `agent_id` + status URL immediately
2. Client polls status endpoint for completion
3. No HTTP timeout risk - long-polling handles delays

## Benefits

- Timeout error messages can include exact `agent_id` for recovery
- Better UX: "Agent agent_xyz created but timed out" vs "Use agent_tree() to find your agent"
- Aligns with async-first architecture
- Easier to add progress/status updates later

## Current Workaround

Server tries to return `agent_id` in error response when timeout occurs, but HTTP fetch timeouts prevent the response from being received.
