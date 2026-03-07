# Slack: Send Thread Reply

Post a reply into an existing Slack message thread using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `chat:write` scope
- You must have `CHANNEL` and `THREAD_TS` from the original message (captured when sent via `send-message.md`)

## Sending a Thread Reply

For any non-trivial message, write the payload to a file to avoid shell escaping issues:

```bash
cat > /tmp/slack_reply.json << 'EOF'
{
  "channel": "<CHANNEL_ID>",
  "thread_ts": "<THREAD_TS>",
  "text": "Your message here."
}
EOF

RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @/tmp/slack_reply.json)

rm /tmp/slack_reply.json
echo $RESPONSE | jq '.ok'
```

If `.ok` is `false`, check `.error` (e.g. `channel_not_found`, `invalid_ts`).

## Simple Inline Version

For short messages with no special characters:

```bash
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\": \"<CHANNEL_ID>\", \"text\": \"<MESSAGE_TEXT>\", \"thread_ts\": \"<THREAD_TS>\"}")

echo $RESPONSE | jq '.ok'
```

## Example

```bash
cat > /tmp/slack_reply.json << 'EOF'
{
  "channel": "C01NUBB8FFZ",
  "thread_ts": "1772208447.444859",
  "text": "Production deployment complete! :shipit:"
}
EOF

RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @/tmp/slack_reply.json)

rm /tmp/slack_reply.json
echo $RESPONSE | jq '.ok'
```
