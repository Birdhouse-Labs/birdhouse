# How to Clean Up Local Branches with Deleted Remotes

**CRITICAL:** When remote branches are deleted (e.g., merged PRs), their local tracking branches become stale. This skill shows how to safely identify and remove them, including their associated worktrees.

## Step 1: Update Remote References

```bash
git fetch --prune
```

This fetches all updates from the remote and removes remote-tracking references that no longer exist. After this command, git marks local branches whose upstreams were deleted with `[gone]`.

## Step 2: Identify Branches to Clean Up

```bash
git branch -v | grep '\[gone\]'
```

**Example output:**
```
  feature-123       a1b2c3d [gone] Add user authentication
* bugfix-456        d4e5f6g [gone] Fix null pointer error
  refactor-789      g7h8i9j [gone] Refactor payment logic
```

The `[gone]` marker indicates the remote branch was deleted.

**Extract just the branch names:**
```bash
git branch -v | grep '\[gone\]' | awk '{print $1}' | sed 's/^[* ]*//'
```

**Example output:**
```
feature-123
bugfix-456
refactor-789
```

## Step 3: Check for Worktrees

**List all worktrees:**
```bash
git worktree list
```

**Example output:**
```
/Users/user/repo                    a1b2c3d [main]
/Users/user/repo/.worktrees/ft-123 d4e5f6g [feature-123]
```

**Check if a specific branch has a worktree:**
```bash
git worktree list --porcelain | grep -B2 "branch refs/heads/BRANCH_NAME$" | grep "^worktree" | cut -d' ' -f2
```

Replace `BRANCH_NAME` with the actual branch. If this outputs a path, the branch has a worktree. If empty, it doesn't.

## Step 4: Clean Up Each Branch

### For Branches WITH Worktrees

**✅ CORRECT order (worktree first, then branch):**

```bash
# 1. Remove the worktree
git worktree remove /path/to/worktree

# 2. Delete the branch
git branch -D branch-name
```

**If the worktree has uncommitted changes or other issues:**
```bash
git worktree remove --force /path/to/worktree
```

### For Branches WITHOUT Worktrees

```bash
git branch -D branch-name
```

**Why `-D` instead of `-d`?** Since the remote is gone, git considers the branch "unmerged" and `-d` will fail. Use `-D` to force deletion.

## Step 5: Clean Up Worktree Metadata

```bash
git worktree prune
```

This removes stale worktree administrative files in `.git/worktrees/` for worktrees that no longer exist on disk.

## Complete Example

```bash
# 1. Fetch and prune
git fetch --prune

# 2. Check what needs cleanup
git branch -v | grep '\[gone\]'

# Sample output:
#   feature-auth    a1b2c3d [gone] Add authentication
#   bugfix-null     d4e5f6g [gone] Fix null pointer

# 3. Check for worktrees
git worktree list

# Sample output:
#   /Users/user/repo                           a1b2c3d [main]
#   /Users/user/repo/.worktrees/feature-auth  d4e5f6g [feature-auth]

# 4. Clean up feature-auth (has worktree)
git worktree remove /Users/user/repo/.worktrees/feature-auth
git branch -D feature-auth

# 5. Clean up bugfix-null (no worktree)
git branch -D bugfix-null

# 6. Prune stale metadata
git worktree prune
```

## Important Rules

- ✅ **ALWAYS** run `git fetch --prune` first to update remote tracking info
- ✅ **ALWAYS** remove worktrees BEFORE deleting branches
- ✅ **ALWAYS** use `-D` (force delete) for `[gone]` branches (they appear unmerged)
- ❌ **NEVER** delete the branch before removing its worktree (git will complain)
- ❌ **NEVER** try to delete the branch you're currently on (checkout a different branch first)

## What Can Go Wrong

**"Cannot delete checked out branch":**
You're currently on the branch you're trying to delete. Checkout a different branch first:
```bash
git checkout main
git branch -D branch-name
```

**Worktree has uncommitted changes:**
Use `--force` to remove it anyway:
```bash
git worktree remove --force /path/to/worktree
```

**Path is locked or has processes running:**
Close any editors, terminals, or processes using files in that worktree, then try again with `--force`.

## Automation Tips

When cleaning up multiple branches, process them in a loop:

```bash
# Get all gone branches
gone_branches=$(git branch -v | grep '\[gone\]' | awk '{print $1}' | sed 's/^[* ]*//')

# Process each one
for branch in $gone_branches; do
  # Check for worktree
  worktree_path=$(git worktree list --porcelain | grep -B2 "branch refs/heads/$branch$" | grep "^worktree" | cut -d' ' -f2)
  
  if [ -n "$worktree_path" ]; then
    echo "Removing worktree for $branch..."
    git worktree remove --force "$worktree_path"
  fi
  
  echo "Deleting branch $branch..."
  git branch -D "$branch"
done

# Clean up metadata
git worktree prune
```

**Note:** Consider asking for user confirmation before deleting in scripts:
```bash
echo "Found branches to delete: $gone_branches"
echo "Proceed? (y/N)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi
```
