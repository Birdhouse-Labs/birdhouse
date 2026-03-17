---
name: github-ci-failure-diagnosis
description: Systematically diagnose GitHub PR CI check failures using gh CLI with a 3-step workflow. Use when dealing with ci check failure, ci failing, github checks failing, pr checks failed, diagnose ci, investigate ci failures, or debug github workflows.
tags:
  - git
  - github
  - ci
version: 1.0.0
author: Birdhouse Team
---

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
gh run view <RUN_ID> --repo <OWNER>/<REPO> --log
```

**What this shows:**

- Complete logs from all jobs in the workflow run
- Error messages and stack traces
- The exact point where the workflow failed
- Environment details and setup logs

## Complete Example

```bash
# 1. Quick overview
gh pr checks 1886 --repo myorg/myrepo

# 2. Get detailed status (if needed)
gh pr view 1886 --repo myorg/myrepo --json statusCheckRollup

# 3. Fetch logs for failed run (replace with actual run ID)
gh run view 19084697022 --repo myorg/myrepo --log
```

## Tips

- **Step 1 is usually sufficient** for most debugging - it shows failed checks and provides direct links
- **Use Step 2** when you need to programmatically extract run IDs or get machine-readable status
- **Use Step 3** when you need complete logs to understand the failure
- Look for the first error in the logs - subsequent errors are often cascading failures

## Overview

Systematic 3-step workflow using GitHub CLI to diagnose PR CI failures: quick status overview, detailed check information, and failure log retrieval.
