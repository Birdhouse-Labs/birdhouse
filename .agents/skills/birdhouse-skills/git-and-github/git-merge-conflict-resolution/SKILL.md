---
name: git-merge-conflict-resolution
description: Resolve git merge conflicts by understanding both sides first. Use when you need to resolve conflicts, merge conflict, git conflict, fix merge conflict, resolve merge conflict, handle conflict, or deal with conflicting changes.
tags:
  - git
version: 1.0.0
author: Birdhouse Team
---

# 🚨 CRITICAL RULE: UNDERSTAND BOTH SIDES BEFORE RESOLVING! 🚨

**Before resolving ANY merge conflict, you MUST understand what changes were made on BOTH sides.**

The conflict markers show you WHERE the conflict is, not WHY it exists.

## The Workflow

### 1. Find the Merge Base
```bash
# For merge conflicts
git merge-base HEAD MERGE_HEAD

# For rebase conflicts
git merge-base HEAD REBASE_HEAD

# Save the SHA - you'll need it
```

### 2. Read What YOUR Branch Changed
```bash
# Show what YOUR branch changed from the merge base
git diff <merge-base-sha>..HEAD -- path/to/file.ts
```

Read this carefully. What did your branch do?

### 3. Read What THEIR Branch Changed
```bash
# Show what THEIR branch changed from the merge base
git diff <merge-base-sha>..MERGE_HEAD -- path/to/file.ts
```

Read this carefully. What did their branch do?

### 4. NOW Read the Conflict Markers
```bash
cat path/to/file.ts
```

With full context of both sides, you can make an informed decision.

### 5. Resolve
Edit the file to incorporate both changes appropriately, or choose one side if needed.

### 6. Mark as Resolved
```bash
git add path/to/file.ts
git commit  # For merge
git rebase --continue  # For rebase
```

## ⚠️ OURS vs THEIRS: They Flip!

**How to tell which you're in:**
```bash
# Check for these files in .git/
test -f .git/MERGE_HEAD && echo "MERGE" || echo "not merge"
test -f .git/REBASE_HEAD && echo "REBASE" || echo "not rebase"
```

**During MERGE:**
- `--ours` = current branch (what you're merging INTO)
- `--theirs` = incoming branch (what you're merging FROM)

**During REBASE (FLIPPED!):**
- `--ours` = upstream branch (where you're rebasing ONTO)
- `--theirs` = your commits (being replayed)

Why? Rebase replays your commits on top of the target, so it checks out the target first.

```bash
# Use with caution - only when you're certain
git checkout --ours path/to/file.ts   # Keep one side
git checkout --theirs path/to/file.ts # Keep other side
```

## Remember

1. **ALWAYS find the merge base first**
2. **ALWAYS read diffs from both sides**
3. **NEVER blindly accept one side**
4. The 2 minutes to understand context saves hours of debugging

## Overview

Ensures agents understand BOTH sides of a merge conflict before resolving it by finding the merge base and reading diffs from both branches.
