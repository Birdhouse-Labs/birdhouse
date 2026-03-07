# Slack: Read Channel History

Fetch messages from a Slack channel using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `channels:history` scope (public channels) or `groups:history` scope (private channels)
- The bot/user must be a member of the channel

## Fetch Recent Messages

```bash
curl -s "https://slack.com/api/conversations.history?channel=<CHANNEL_ID>&limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text, reply_count: .reply_count}]'
```

Messages are returned newest-first.

## Fetch Messages Within a Time Range

```bash
curl -s "https://slack.com/api/conversations.history?channel=<CHANNEL_ID>&oldest=<START_TS>&latest=<END_TS>&limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text}]'
```

## Fetch Messages From the Last 24 Hours

```bash
OLDEST=$(date -v-1d +%s)  # macOS
# OLDEST=$(date -d "1 day ago" +%s)  # Linux

curl -s "https://slack.com/api/conversations.history?channel=<CHANNEL_ID>&oldest=$OLDEST&limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text}]'
```

## Check for Threads

Messages with `reply_count > 0` have thread replies. Use the message `ts` with `read-thread.md` to fetch them:

```bash
curl -s "https://slack.com/api/conversations.history?channel=<CHANNEL_ID>&limit=20" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | select(.reply_count > 0) | {ts: .ts, text: .text, reply_count: .reply_count}]'
```

## Notes

- Messages are returned newest-first — append `| reverse` in jq for chronological order
- If `.has_more` is `true`, pass `&cursor=<response_metadata.next_cursor>` for the next page
- `user` is populated for human messages, `bot_profile.name` for bot messages — check both
- If `.ok` is `false`, check `.error` (e.g. `not_in_channel`, `missing_scope`)
