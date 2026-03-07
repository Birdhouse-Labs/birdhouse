# Slack: Send Message

Send a message to a Slack channel using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `chat:write` scope
- The bot/user must be a member of the target channel

## Option A: Plain Text Message

```bash
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\": \"<CHANNEL_ID>\", \"text\": \"<MESSAGE_TEXT>\"}")

echo $RESPONSE | jq '.ok'
```

## Option B: Block Kit Message (from JSON file)

The blocks file must contain a valid Slack Block Kit **array** (not wrapped in an object). Always read the file first to verify it is pure JSON with no markdown fences.

Write the full payload to a file to avoid shell escaping issues:

```bash
cat > /tmp/slack_message.json << 'EOF'
{
  "channel": "<CHANNEL_ID>",
  "text": "<FALLBACK_TEXT>",
  "blocks": <BLOCKS_ARRAY>
}
EOF

RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d @/tmp/slack_message.json)

rm /tmp/slack_message.json
echo $RESPONSE | jq '.ok'
```

## Capturing the Response

**Always check `ok` and capture `channel` + `ts`** — they are required for thread replies (see `send-thread-reply.md`):

```bash
echo $RESPONSE | jq '.ok'          # must be true — if false, check .error
echo $RESPONSE | jq -r '.channel'  # store as CHANNEL
echo $RESPONSE | jq -r '.ts'       # store as THREAD_TS
```

If `.ok` is `false`, the `.error` field explains why (e.g. `channel_not_found`, `not_in_channel`).

## Example

```bash
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"channel": "C01NUBB8FFZ", "text": "Deployment complete!"}')

echo $RESPONSE | jq '.ok'
THREAD_TS=$(echo $RESPONSE | jq -r '.ts')
CHANNEL=$(echo $RESPONSE | jq -r '.channel')
```
