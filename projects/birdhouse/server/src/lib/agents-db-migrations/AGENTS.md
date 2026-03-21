# agents.db Migrations

This directory contains the Kysely migration system for `agents.db`.

For the full guide — how to write a migration, how to verify it, what the scripts do, and what not to do — see [`../migrations/AGENTS.md`](../migrations/AGENTS.md).

The relevant command for generating a new agents.db migration is:

```bash
bun run agent-migration:new <descriptive_name>
```
