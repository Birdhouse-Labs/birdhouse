---
name: slack
description: Use this skill when you need to interact with Slack — sending messages, posting thread replies, sending DMs, looking up users or channels, or reading channel history and threads.
---

# Slack Skill

This skill covers all Slack operations via the Slack API.

## Token Requirements

All operations require a Slack token passed by the caller. **If no token has been specified, ask before proceeding.**

There are two token types:

**Bot Token (`xoxb-`)** — acts as a bot user (e.g. "Merlin")
- Created from a Slack App's OAuth & Permissions page
- Posts messages as the bot, not as a person

**User Token (`xoxp-`)** — acts as a real Slack user
- Created from a Slack App's OAuth & Permissions page under "User Token Scopes"
- Posts messages as the authenticated person

### How to Help a User Create a Token

If the user doesn't have a token, direct them to https://api.slack.com/apps and walk them through:

1. Create a new app (or use an existing one)
2. Go to **OAuth & Permissions**
3. Add the required Bot Token Scopes (see below)
4. Click **Install to Workspace**
5. Copy the **Bot User OAuth Token** (`xoxb-...`)

## Required Scopes by Operation

| Operation | Scope(s) Required |
|---|---|
| Send message to channel | `chat:write`, `chat:write.public` |
| Send DM | `chat:write`, `im:write` |
| Look up users | `users:read` |
| Find channels | `channels:read`, `groups:read` |
| Read channel history | `channels:history`, `groups:history` |
| Read thread replies | `channels:history`, `groups:history` |

## Available Operations

See each file for full instructions:

- **[send-message.md](send-message.md)** — Send a message to a channel (plain text or Block Kit)
- **[send-thread-reply.md](send-thread-reply.md)** — Post a reply into an existing thread
- **[send-dm.md](send-dm.md)** — Send a direct message to a user
- **[lookup-user.md](lookup-user.md)** — Find a user's ID by name or email
- **[find-channel.md](find-channel.md)** — Find a channel's ID by name
- **[read-channel-history.md](read-channel-history.md)** — Read recent messages from a channel
- **[read-thread.md](read-thread.md)** — Read replies in a message thread
