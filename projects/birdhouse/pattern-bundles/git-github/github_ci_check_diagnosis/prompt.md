# AI Prompt: Quickly Diagnose CI Check Failures on GitHub PRs

## Objective

When asked to investigate CI failures on a GitHub Pull Request, follow this efficient workflow using the GitHub CLI (`gh`) to quickly identify failed checks and their root causes.

## Prerequisites

- GitHub CLI (`gh`) must be installed and authenticated
- You need the repository name and PR number

## Workflow

### Step 1: Quick Status Overview

Use `gh pr checks` to get a quick visual summary of all check statuses:

```bash
gh pr checks <PR_NUMBER> --repo <OWNER>/<REPO>
```

**What this shows:**

- ✓ Successful checks
- X Failed checks
- - Skipped checks
- Summary counts (failed, successful, skipped, pending)
- URLs to each check

**Example:**

```bash
gh pr checks 1886 --repo your-org/your-repo
```

### Step 2: Get Detailed Check Information

If you need to identify the specific workflow run ID for failed checks, use:

```bash
gh pr view <PR_NUMBER> --repo <OWNER>/<REPO> --json statusCheckRollup
```

**What this shows:**

- Complete list of all checks with their conclusions (FAILURE, SUCCESS, SKIPPED)
- Workflow run IDs (needed for fetching logs)
- Direct URLs to each check
- Timestamps (startedAt, completedAt)

**Key fields to look for:**

- `"conclusion": "FAILURE"` - identifies failed checks
- `"detailsUrl"` - contains the run ID (e.g., `.../runs/19084697022/...`)
- `"name"` - the specific job name that failed

### Step 3: Fetch Failure Logs

Once you have the run ID from the failed check, get the complete failure logs:

```bash
gh run view <RUN_ID> --repo <OWNER>/<REPO> --log-failed
```

**What this shows:**

- Complete logs ONLY for the failed jobs (filtered output)
- Error messages, stack traces, linting errors, test failures
- The exact lines where failures occurred

**Example:**

```bash
gh run view 19084697022 --repo your-org/your-repo --log-failed
```

## Complete Example Workflow

Given PR: https://github.com/your-org/your-repo/pull/1886

```bash
# Step 1: Quick check
gh pr checks 1886 --repo your-org/your-repo
# Output: Shows "Your App Pull Request CI" is failing

# Step 2: Get run ID
gh pr view 1886 --repo your-org/your-repo --json statusCheckRollup
# Output: Find the failed check with run ID 19084697022

# Step 3: Get failure logs
gh run view 19084697022 --repo your-org/your-repo --log-failed
# Output: Shows specific linting errors with file names and line numbers
```

## Real-World Output Example

From the example PR above, Step 3 revealed the root cause:

```
./components/contexts/WebSocketConnectionProvider.tsx
67:5  Error: Unexpected console statement.  no-console
71:7  Error: Unexpected console statement.  no-console
86:7  Error: Unexpected console statement.  no-console
94:9  Error: Unexpected console statement.  no-console

./components/app/deals/shared/WebSocketDebugButton.tsx
24:7  Error: Unexpected console statement.  no-console
28:5  Error: Unexpected console statement.  no-console
34:25  Error: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
60:45  Error: Expected '!==' and instead saw '!='.  eqeqeq
```

## Tips for AI Agents

1. **Start with Step 1** for a quick overview - it's the fastest way to see if anything failed
2. **Use Step 2** when you need specific run IDs or detailed check information
3. **Use Step 3** to get the actual error messages and root causes
4. **Parse JSON output** in Step 2 by adding `| jq` if you need to filter specific fields
5. **Look for patterns** in logs:
   - Linting errors → file paths + line numbers + rules
   - Test failures → test names + assertion errors + stack traces
   - Build failures → compilation errors + missing dependencies

## Alternative: One-Shot Deep Dive

If you want comprehensive information in one command:

```bash
gh pr view <PR_NUMBER> --repo <OWNER>/<REPO> --json title,statusCheckRollup | \
  jq '.statusCheckRollup[] | select(.conclusion == "FAILURE")'
```

This filters to show only failed checks with their details.

## Summary

The three-step approach is:

1. 🔍 **Quick scan**: `gh pr checks` - See what failed at a glance
2. 🎯 **Identify**: `gh pr view --json statusCheckRollup` - Get run IDs
3. 📋 **Diagnose**: `gh run view --log-failed` - Read the actual error logs

This workflow allows you to go from "What's the CI status?" to "Here's exactly why it failed and what lines need to be fixed" in under 30 seconds.
