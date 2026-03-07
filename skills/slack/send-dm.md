# Slack: Send DM

Send a direct message to a Slack user using the Slack API.

## Prerequisites

- A Slack token must be provided by the caller. If no token has been specified, ask before proceeding.
- The token must have `chat:write` and `im:write` scopes
- You need the recipient's Slack user ID (e.g. `U01MWN00MJL`) — use `lookup-user.md` if you only have their name

## Step 1: Open a DM Channel

```bash
RESPONSE=$(curl -s -X POST "https://slack.com/api/conversations.open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"users\": \"<USER_ID>\"}")

DM_CHANNEL=$(echo $RESPONSE | jq -r '.channel.id')
echo $RESPONSE | jq '.ok'
```

## Step 2: Send the Message

```bash
RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\": \"$DM_CHANNEL\", \"text\": \"<MESSAGE_TEXT>\"}")

echo $RESPONSE | jq '.ok'
```

## Combined Example

```bash
TOKEN="<YOUR_TOKEN>"
USER_ID="U01MWN00MJL"

DM_CHANNEL=$(curl -s -X POST "https://slack.com/api/conversations.open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"users\": \"$USER_ID\"}" | jq -r '.channel.id')

RESPONSE=$(curl -s -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"channel\": \"$DM_CHANNEL\", \"text\": \"Hey! Just wanted to give you a heads up.\"}")

echo $RESPONSE | jq '.ok'
```

## Notes

- `conversations.open` is idempotent — calling it multiple times with the same user returns the same DM channel
- If `.ok` is `false`, check `.error` (e.g. `missing_scope`, `user_not_found`)
- To send a group DM, pass a comma-separated list: `"users": "U123,U456"`
