---
name: github-pr-review-replies
description: Reply to GitHub PR review comments as threaded responses using the GitHub API. Use when you want to reply to the pr comment, reply to the github comment, reply in the github thread, use gh api replies, or respond to github threads.
tags:
  - git
  - github
version: 1.0.0
author: Birdhouse Team
---

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

# Post the reply as a threaded comment
REPLY_BODY=$(cat /tmp/pr-reply-${COMMENT_ID}.txt)
gh api /repos/$OWNER/$NAME/pulls/$PR/comments/$COMMENT_ID/replies \
  --method POST -f body="$REPLY_BODY"

# Clean up
rm /tmp/pr-reply-${COMMENT_ID}.txt
```

## Why Use /replies?

- **Without /replies**: Creates a new top-level comment
- **With /replies**: Creates a threaded reply in the existing conversation

Always use `/replies` for review comment responses to maintain conversation threading.

## Overview

Ensures PR review replies appear as threaded comments using the correct GitHub API endpoint instead of creating new top-level comments.
