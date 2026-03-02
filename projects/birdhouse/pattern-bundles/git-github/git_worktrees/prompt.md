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

When using file editing tools (`search_replace`, `MultiEdit`, `write`, etc.) in worktrees:

- ❌ **NEVER** use relative paths: `file.txt` or `.github/workflows/file.yml`
- ✅ **ALWAYS** use absolute paths: `/full/path/to/worktree/file.txt`

**Why**: File editing tools may resolve relative paths from the workspace root instead of your current working directory, causing edits to the original directory instead of the worktree.

**Example**:

```bash
# ❌ WRONG (edits original directory):
search_replace("file.txt", "old", "new")
search_replace(".github/workflows/build.yml", "old", "new")

# ✅ CORRECT (edits worktree):
search_replace("/Users/user/repo/worktrees/task-name/file.txt", "old", "new")
search_replace("/Users/user/repo/worktrees/task-name/.github/workflows/build.yml", "old", "new")
```

**Always use `pwd` to get your current worktree path and construct absolute paths for file editing.**

## Common Mistake to Avoid

**❌ DO NOT DO THIS:**

```bash
cd /original/repo
git checkout -b new-branch  # ← This changes the original directory!
git worktree add worktrees/task new-branch
```

**✅ DO THIS INSTEAD:**

```bash
cd /original/repo  # Stay on whatever branch user was on
git worktree add worktrees/task -b new-branch origin/main  # Creates branch from origin/main in worktree only
cd worktrees/task  # Now work here
```

## If You Break This Rule

- You will corrupt the user's work
- You will cause merge conflicts
- You will disrupt their current state
- You will change their active branch
- **DON'T DO IT**

## Pushing Your Branch

When asked to push your feature branch, do it correctly:

```bash
# ✅ CORRECT: Push and set upstream to YOUR feature branch
git push -u origin branch-name

# ❌ WRONG: This sets upstream to main instead of your feature branch!
git push -u origin main
git push --set-upstream origin main
```

**Key Points:**

- Your branch was created FROM `origin/main` (starting point)
- But it should track `origin/branch-name` (its own remote branch)
- Use `git push -u origin <your-branch-name>` on first push
- After first push, `git push` will work automatically

## Additional notes

- You will likely have to run `mix deps.get` in the worktree before you are able to run other mix tasks like `mix compile` or `mix test.deals`
- Assume the user is likely using the list of commits to review your changes; commit often.
