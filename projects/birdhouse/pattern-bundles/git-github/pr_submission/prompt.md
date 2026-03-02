# How to Submit GitHub Pull Requests with `gh` CLI

Use heredoc syntax for multi-line PR descriptions.

## Basic Usage

**Simple PR (opens interactive prompt for body):**

```bash
gh pr create --title "Add feature X"
```

**With inline body (for short descriptions):**

```bash
gh pr create --title "Fix login redirect" --body "Fixes issue with OAuth callback URL"
```

## Multi-line Descriptions (Use Heredoc)

```bash
gh pr create --title "Add rocket boosters to the login button" --body "$(cat <<'EOF'
## Summary

Made the login button go REALLY fast. Like, uncomfortably fast.

## Changes

- Added flames emoji 🔥
- Increased button velocity by 300%
- Users now experience mild g-forces during authentication
- Login success rate: still 100% (just faster)

## Testing

- Tested on production (yolo)
- My mouse caught fire but in a good way
EOF
)"
```

**How it works:**
- `cat <<'EOF'` starts a heredoc - everything until closing `EOF` is literal text
- `$(...)` captures the heredoc output as a string
- `--body "..."` receives the complete multi-line string
- Single quotes around `'EOF'` prevent variable expansion

## Common Options

**Draft PR:**
```bash
gh pr create --draft --title "WIP: Experimental feature" --body "..."
```

**Different base branch:**
```bash
gh pr create --base develop --title "Feature X" --body "..."
```

**Add reviewers:**
```bash
gh pr create --title "Fix bug" --body "..." --reviewer alice,bob
```

**From a file:**
```bash
gh pr create --title "Feature: User preferences" --body "$(cat pr-description.md)"
```

## Don't Use Inline Strings with Special Characters

```bash
# ❌ This breaks - shell tries to interpret "!" and newlines
gh pr create --title "Add rocket boosters!" --body "Added cool stuff!\nReally fast now!"
```

Use heredoc instead.
