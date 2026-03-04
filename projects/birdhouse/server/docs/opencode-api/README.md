# OpenCode API — Common Gotchas

## The `directory` query parameter

**Most OpenCode endpoints require `?directory=<workspaceRoot>` or they silently return wrong/empty data.**

OpenCode runs a single process that can serve multiple workspaces. Every request goes through middleware that reads the `directory` param (or `x-opencode-directory` header, or falls back to `process.cwd()`) to select the correct workspace instance. If `directory` is missing or wrong, you get data from a different instance — typically `process.cwd()`, which is empty.

### How to know if an endpoint needs it

**Needs `directory`:** Any endpoint whose underlying module calls `Instance.state()` — meaning it reads workspace-scoped data. This includes sessions, messages, permissions, questions, MCP, config, providers, PTY, and file operations. In practice: if the data is per-workspace, pass `directory`.

**Doesn't need `directory`:** Endpoints that return global/process-level data — `/log`, `/health`, and similar infrastructure endpoints that aren't routed through the instance middleware.

When in doubt, pass it. There's no harm in sending `directory` to an endpoint that doesn't need it.

### In the Birdhouse OpenCode client

`workspaceRoot` is already available as a closure variable in `createLiveOpenCodeClient`. Every `fetch` call in the live client should use:

```ts
`${baseUrl}/some/endpoint?directory=${encodeURIComponent(workspaceRoot)}`
```

Look at how `getSession`, `getMessages`, `getSessionStatus` etc. are implemented — they all include it. If you're adding a new method and omitting `directory`, make sure you have a specific reason.

### The bug this caught

`listPendingQuestions()` was calling `GET /question` without `directory`. OpenCode returned `[]` every time even when questions were pending — the pending map lived in the correct workspace instance, but the request was reading `process.cwd()`'s (empty) instance. Both the GET endpoint and the callID→questionID resolution silently failed.
