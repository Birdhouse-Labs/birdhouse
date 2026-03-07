# Slack: Read Thread

Fetch all replies in a Slack message thread using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `channels:history` scope (public channels) or `groups:history` scope (private channels)
- You must have the `CHANNEL_ID` and `THREAD_TS` of the parent message

## Fetch Thread Replies

```bash
curl -s "https://slack.com/api/conversations.replies?channel=<CHANNEL_ID>&ts=<THREAD_TS>" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text}]'
```

The first message in the array is the parent. Subsequent messages are the replies.

## Extract Just the Replies (Skip Parent)

```bash
curl -s "https://slack.com/api/conversations.replies?channel=<CHANNEL_ID>&ts=<THREAD_TS>" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[1:] | .[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text}]'
```

## Check if Anyone Has Replied

```bash
curl -s "https://slack.com/api/conversations.replies?channel=<CHANNEL_ID>&ts=<THREAD_TS>" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.messages | length'
# Returns 1 if no replies (just the parent), >1 if replies exist
```

## Example

```bash
curl -s "https://slack.com/api/conversations.replies?channel=C01NUBB8FFZ&ts=1772208447.444859" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.messages[] | {ts: .ts, user: .user, bot: .bot_profile.name, text: .text}]'
```

## Notes

- `user` is populated for human messages, `bot_profile.name` for bot messages — check both
- If `.has_more` is `true`, pass `&cursor=<response_metadata.next_cursor>` for the next page
- If `.ok` is `false`, check `.error` (e.g. `channel_not_found`, `missing_scope`)
