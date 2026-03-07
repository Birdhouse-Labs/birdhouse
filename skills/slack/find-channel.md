# Slack: Find Channel

Look up a Slack channel's ID by name using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `channels:read` scope (public channels) and/or `groups:read` scope (private channels)

## Find a Channel by Name

```bash
curl -s "https://slack.com/api/conversations.list?limit=1000&exclude_archived=true&types=public_channel,private_channel" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.channels[] | select(.name | test("(?i)<search_term>")) | {id: .id, name: .name, is_private: .is_private}]'
```

Replace `<search_term>` with the channel name or partial name (e.g. `prod`, `general`).

## Example

```bash
curl -s "https://slack.com/api/conversations.list?limit=1000&exclude_archived=true&types=public_channel,private_channel" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.channels[] | select(.name | test("(?i)prod")) | {id: .id, name: .name, is_private: .is_private}]'
```

## Notes

- Results are paginated for large workspaces — if you get a `next_cursor` in the response, pass it as `&cursor=<next_cursor>` to get the next page
- If no results come back for a private channel, the bot/user may not be a member of it
- `is_private: true` means the channel is private
