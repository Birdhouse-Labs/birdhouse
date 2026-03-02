# How to Reply to GitHub PR Review Comments

**CRITICAL:** Use the `/replies` API endpoint to thread replies into existing comment threads.

## Basic Usage (Inline Text)

```bash
# Get comment ID from the review thread data (use "last_comment_id" field)
gh api /repos/OWNER/NAME/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
  --method POST -f body="Your reply text here"
```

## Posting Reply from File

**✅ CORRECT - Read file contents:**

```bash
# Option 1: Command substitution (recommended)
REPLY_BODY=$(cat /path/to/reply.txt)
gh api /repos/OWNER/NAME/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
  --method POST -f body="$REPLY_BODY"

# Option 2: Direct command substitution
gh api /repos/OWNER/NAME/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
  --method POST -f body="$(cat /path/to/reply.txt)"
```

**❌ WRONG - This posts the filename literally, not the contents:**

```bash
# This will post "@/path/to/reply.txt" as the comment body!
gh api /repos/OWNER/NAME/pulls/PR_NUMBER/comments/COMMENT_ID/replies \
  --method POST -f body=@/path/to/reply.txt
```

## Complete Example Workflow

```bash
# Setup variables
PR=6313
COMMENT_ID=2508381598
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=${OWNER_REPO%/*}
NAME=${OWNER_REPO#*/}

# Write reply to file
cat > /tmp/pr-reply-${COMMENT_ID}.txt << 'EOF'
Thanks for the review! I've addressed this by...
EOF

# Read and post reply
REPLY_BODY=$(cat /tmp/pr-reply-${COMMENT_ID}.txt)
gh api -X POST \
  "/repos/$OWNER/$NAME/pulls/$PR/comments/$COMMENT_ID/replies" \
  -f body="$REPLY_BODY"

echo "✅ Reply posted to comment $COMMENT_ID"
```

## What NOT to Use

**❌ NEVER use these (they create new reviews/comments instead of threading):**

- `gh pr review PR --comment --body "..."` - Creates new review, not threaded reply
- `gh pr comment PR --body "..."` - Creates new PR comment, not threaded reply
- `-f body=@filename` syntax - Posts filename string instead of file contents
