---
name: git-worktree-workflow
description: Create isolated working directories using git worktrees without affecting the main workspace. Use when you want to use worktree, git worktree, worktree workflow, isolated development, work in worktree, create worktree, or worktree best practices.
tags:
  - git
  - worktree
version: 1.0.0
author: Birdhouse Team
---

# 🚨 CRITICAL RULE: NEVER TOUCH THE ORIGINAL DIRECTORY! 🚨

**ALL commands, file edits, git operations, and changes MUST happen inside the worktree directory ONLY.**

The user's original workspace must remain completely untouched.

Please include the fact that you are working in a worktree in every response to help you remember.

## Simple Workflow

1. **Create worktree with new branch** (ONE COMMAND): `git worktree add worktrees/task-name -b branch-name origin/main`
2. **Move into it**: `cd worktrees/task-name`
3. **Verify location**: `pwd` (must show worktrees/task-name path)
4. **Do ALL work inside this directory**
5. **Stay here** - don't return to original directory

### ⚠️ **CRITICAL**: Creating New Branches

- ✅ **CORRECT**: `git worktree add worktrees/task-name -b branch-name origin/main` (creates branch + worktree from origin/main)
- ❌ **WRONG**: `git checkout -b branch-name` then `git worktree add...` (changes original directory!)
- ❌ **WRONG**: Any `git checkout` or branch creation in original directory

**The `-b` flag creates the branch inside the worktree, leaving your original directory untouched.**

### 🔑 **Key Point**: ONE COMMAND ONLY

**ALWAYS use this exact pattern:**

```bash
git worktree add worktrees/task-name -b branch-name origin/main
```

This ensures your new branch always starts from the latest origin/main, regardless of your current local branch state.

**NEVER split it into multiple commands or create branches first!**

### 🎯 **Why `origin/main` is Important**

Without specifying `origin/main`, the new branch is created from whatever commit you're currently on:

- ❌ `git worktree add worktrees/task -b branch` → Creates from current HEAD (could be old/wrong)
- ✅ `git worktree add worktrees/task -b branch origin/main` → Always creates from latest origin/main

**Always use `origin/main` to ensure a clean, up-to-date starting point.**

## Absolute Rules

- ❌ **NEVER** run commands in the original directory
- ❌ **NEVER** edit files outside the worktree
- ❌ **NEVER** use `git add`, `git commit`, `git stash` outside the worktree
- ❌ **NEVER** run `git checkout`, `git checkout -b`, or any branch creation in original directory
- ❌ **NEVER** switch branches in the original directory
- ✅ **ALWAYS** verify you're in `worktrees/task-name` before any operation
- ✅ **ALWAYS** use `git worktree add worktrees/name -b branch-name origin/main` in ONE command
- ✅ **ALL** work happens in the worktree directory only

## 🔧 **CRITICAL: File Editing Tool Usage**

When using file editing tools in worktrees:

- ❌ **NEVER** use relative paths: `file.txt` or `.github/workflows/file.yml`
- ✅ **ALWAYS** use absolute paths: `/full/path/to/worktree/file.txt`

**Always use `pwd` to get your current worktree path and construct absolute paths for file editing.**

## If You Break This Rule

- You will corrupt the user's work
- You will cause merge conflicts
- You will disrupt their current state
- You will change their active branch
- **DON'T DO IT**

## Overview

Creates isolated working directories from your repository, leaving your main workspace untouched while enabling parallel development on different features.
