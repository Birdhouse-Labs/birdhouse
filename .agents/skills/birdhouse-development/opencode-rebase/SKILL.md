---
name: opencode-rebase
description: Re-apply the Birdhouse opencode fork commits onto a new upstream tag one commit at a time. Load this skill when rebasing Birdhouse's custom opencode patches onto a fresh upstream release.
tags:
  - birdhouse
  - opencode
  - rebase
  - maintenance
version: 1.0.0
author: Cody Rayment
---

# Opencode Rebase

Re-apply Birdhouse's fork commits onto a fresh upstream opencode tag. Do not run a traditional `git rebase`. Recreate each commit's intent on top of the new tag, validate it, and commit it as a fresh patch.

## Preconditions

- Work in the opencode repo, not the Birdhouse monorepo.
- Keep the old fork branch as `birdhouse`.
- Read the current commit inventory from `BIRDHOUSE.md` in the repo root.
- Create a dedicated worktree from the new upstream tag before touching code.
- Run all CI from the worktree root, never from `packages/opencode`.

## Quick Start

1. Create a worktree from the new upstream tag.
2. Read `BIRDHOUSE.md` and build the commit checklist.
3. Review each commit against upstream before applying it; skip absorbed fixes.
4. Port one commit at a time: read old diff, map intent to current files, apply, run CI, commit.
5. Create a backup branch before squash cleanup.
6. After the full pass, squash cleanup commits, keep prompt commits separate, and update `BIRDHOUSE.md`.

## Workflow

1. Create the worktree:
   ```bash
   git worktree add <path> -b birdhouse-<version> <tag>
   ```
   Example:
   ```bash
   git worktree add /tmp/opencode-v1.3.13 -b birdhouse-v1.3.13 v1.3.13
   ```

2. Use the old fork as read-only reference:
   ```bash
   git show <hash>
   git show <hash> -- <path>
   ```
   Run those in the main clone on branch `birdhouse`.

3. Read the commit inventory from `BIRDHOUSE.md`. Treat it as the source of truth for:
   - commits to port
   - current upstream base tag
   - local CI commands
   - fixup/squash guidance

4. Review commits before applying them.
   - Open the old diff with `git show <hash>`.
   - Read the corresponding files in the new worktree.
   - Check whether upstream already absorbed the behavior.
   - Drop absorbed commits without ceremony.

5. Apply commits one at a time.
   - Read the old diff.
   - State the load-bearing intent in one sentence.
   - Read the current file layout in the new worktree.
   - Recreate the behavior in the current architecture.
   - Run CI.
   - Commit with the same subject line.
   - Copy the original commit body for non-trivial commits and update details that changed.

6. Run CI from the worktree root only:
   ```bash
   bun turbo typecheck
   bun turbo test
   ```
   Force rebuild if needed:
   ```bash
   bun turbo typecheck --force
   ```

7. Run CI in a clean environment to avoid machine-local config polluting tests:
   ```bash
   tmp_home="$(mktemp -d)"
   tmp_cfg="$(mktemp -d)"
   tmp_data="$(mktemp -d)"
   tmp_state="$(mktemp -d)"
   tmp_cache="$(mktemp -d)"
   env -i \
     PATH="$PATH" \
     HOME="$tmp_home" \
     USER="test-user" \
     SHELL="${SHELL:-/bin/bash}" \
     TMPDIR="${TMPDIR:-/tmp}" \
     OPENCODE_TEST_HOME="$tmp_home" \
     XDG_CONFIG_HOME="$tmp_cfg" \
     XDG_DATA_HOME="$tmp_data" \
     XDG_STATE_HOME="$tmp_state" \
     XDG_CACHE_HOME="$tmp_cache" \
     bun turbo typecheck && \
   env -i \
     PATH="$PATH" \
     HOME="$tmp_home" \
     USER="test-user" \
     SHELL="${SHELL:-/bin/bash}" \
     TMPDIR="${TMPDIR:-/tmp}" \
     OPENCODE_TEST_HOME="$tmp_home" \
     XDG_CONFIG_HOME="$tmp_cfg" \
     XDG_DATA_HOME="$tmp_data" \
     XDG_STATE_HOME="$tmp_state" \
     XDG_CACHE_HOME="$tmp_cache" \
     bun turbo test
   ```

8. Create a backup branch before cleanup:
   ```bash
   git branch birdhouse-<version>-backup
   ```

9. Finish the branch.
   - Combine tiny cleanup commits into their logical targets.
   - Keep prompt cleanup commits separate; they help future agents find prompt drift.
   - Update the base tag in `BIRDHOUSE.md`.
   - Verify `git status --short` is empty.

## Commits To Review Before Applying

Do not hardcode historical skip lists into the workflow. Instead, look for the same patterns each time:

- Check the exact files touched by the old commit in the new worktree.
- Compare the old diff's intent against the current implementation.
- Skip the commit if the relevant behavior is already present upstream.
- Keep the commit if the code looks similar but the behavior still needs explicit verification.
- Be especially careful with provider, plugin, and prompt commits; they are the most likely to look absorbed while still differing in behavior.

## Gotchas

- Do not trust ambient machine state. Provider/config tests can fail from real local auth, config, or XDG paths. Use the clean-env CI wrapper.
- Do not run `bun run typecheck` or `bun test` inside `packages/opencode`. That produces stale-SDK failures.
- Do not mirror old file paths blindly. Upstream restructuring is common; reapply intent, not line numbers.
- Check prompt files broadly. Upstream may rename or proliferate prompt files across versions; clean all active prompt variants, not just the files touched in the old commit.
- Treat built-in Birdhouse plugin support carefully. The plugin name may be configured as `birdhouse`, but the runtime import and entry handling may need adaptation to the current plugin loader.
- Validate behavior, not just diff shape. The Bedrock autoload fix is a good example: confirm the provider does not load when only `AWS_REGION` is set.
- Preserve commit bodies. The old `birdhouse` branch commit body is the source of truth; update wording only where the implementation path changed.
- Do not start with a full baseline CI pass. Port the next commit, then run CI; baseline failures will surface naturally.

## Key Reminders

- Recreate each commit as a fresh patch; do not use `git cherry-pick`.
- Read old diffs from the `birdhouse` branch clone, never modify that clone.
- Stop treating a commit as required the moment you confirm upstream already absorbed it.
- Keep the branch history understandable; small fixups are fine during the pass, but fold obvious cleanup before calling the branch done.
