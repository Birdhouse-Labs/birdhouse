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
metadata:
  internal: true
---

# Opencode Rebase

Re-apply Birdhouse's fork commits onto a fresh upstream opencode tag. Do not run a traditional `git rebase`. Recreate each commit's intent on top of the new tag, validate it, and commit it as a fresh patch.

You may use `git cherry-pick` when a commit applies cleanly and you have inspected the surrounding upstream code enough to judge that the carried behavior is still correct. Fall back to manual porting when conflicts or architectural drift make cherry-pick unsafe.

## Preconditions

- Work in the opencode repo, not the Birdhouse monorepo.
- Keep the old fork branch as `birdhouse`.
- Read the current commit inventory from `BIRDHOUSE.md` in the repo root.
- Create a dedicated worktree from the new upstream tag before touching code.
- Run all CI from the worktree root, never from `packages/opencode`.

## Quick Start

1. Create a worktree from the new upstream tag.
2. Read `BIRDHOUSE.md` and build the commit checklist.
3. Run `bun install` in the worktree root.
4. If the fork uses the built-in Birdhouse plugin, copy `packages/opencode/src/plugin/birdhouse.ts` into the worktree before validation.
5. Review each commit against upstream before applying it; skip absorbed fixes.
6. Port one commit at a time: read old diff, map intent to current files, apply, run CI, commit.
7. Create a backup branch before squash cleanup.
8. After the full pass, squash cleanup commits, keep prompt commits separate, and update `BIRDHOUSE.md`.

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
   - local CI commands documented for the fork
   - fixup/squash guidance

4. Install dependencies in the new worktree root before running CI:
   ```bash
   bun install
   ```

5. If the fork includes built-in Birdhouse plugin support, ensure the ignored plugin source file exists in the worktree before typecheck/build validation:
   ```bash
   cp <birdhouse-plugin-source> packages/opencode/src/plugin/birdhouse.ts
   ```
   In Birdhouse, the source of truth is the plugin implementation used by the monorepo build/dev sync flow. Check the Birdhouse build scripts or dev plugin sync utility if the source path is unclear.

6. Review commits before applying them.
   - Open the old diff with `git show <hash>`.
   - Read the corresponding files in the new worktree.
   - Check whether upstream already absorbed the behavior.
   - Drop absorbed commits without ceremony.

7. Apply commits one at a time.
   - Read the old diff.
   - State the load-bearing intent in one sentence.
   - Read the current file layout in the new worktree.
   - Recreate the behavior in the current architecture.
   - Prefer `git cherry-pick` when it applies cleanly and the behavior is still obviously correct.
   - Port manually when the commit conflicts or the surrounding implementation has moved enough that cherry-pick would hide important judgment.
   - Run CI.
   - Commit with the same subject line.
   - Copy the original commit body for non-trivial commits and update details that changed.

8. Run CI from the worktree root only.
   The documented fork commands live in `BIRDHOUSE.md` in the repo root. Start there.

   First try the documented root command:
   ```bash
   bun turbo typecheck
   bun turbo test
   ```

   If Bun tries to execute `turbo.json` directly or otherwise mis-resolves `bun turbo`, use the repo-local Turborepo binary instead:
   ```bash
   ./node_modules/.bin/turbo typecheck
   ./node_modules/.bin/turbo test
   ```

   Force rebuild if needed:
   ```bash
   ./node_modules/.bin/turbo typecheck --force
   ```

9. Run CI in a clean environment to avoid machine-local config polluting tests:
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
     ./node_modules/.bin/turbo typecheck && \
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
     ./node_modules/.bin/turbo test
   ```

10. Create a backup branch before cleanup:
   ```bash
   git branch birdhouse-<version>-backup
   ```

11. Finish the branch.
   - Combine tiny cleanup commits into their logical targets.
   - If cleanup requires splitting changes by hunk or line range, load the `git-surgeon` skill before staging or committing those fixes.
   - Prefer explicit `fixup!` commits for post-port corrections discovered by CI.
   - Use `git-surgeon` when it helps you split changes by hunk or line range, but regular `git add` plus `git commit --fixup <hash>` is also fine.
   - Stop and ask the human to review the visible `fixup!` commit stack before any autosquash step.
   - Only after approval, run autosquash so the fixups fold into their targets in one pass.
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
- Run `bun install` in the worktree root before the first CI run. Missing local tools like `tsgo` can make clean-env CI fail for setup reasons unrelated to the port.
- If `bun turbo ...` fails because Bun tries to run `turbo.json`, use `./node_modules/.bin/turbo ...` from the worktree root.
- Do not mirror old file paths blindly. Upstream restructuring is common; reapply intent, not line numbers.
- Check prompt files broadly. Upstream may rename or proliferate prompt files across versions; clean all active prompt variants, not just the files touched in the old commit.
- Treat built-in Birdhouse plugin support carefully. The plugin name may be configured as `birdhouse`, but the runtime import and entry handling may need adaptation to the current plugin loader.
- For built-in Birdhouse plugin support, typecheck/build validation may require the ignored `packages/opencode/src/plugin/birdhouse.ts` file to exist locally in the worktree.
- Validate behavior, not just diff shape. The Bedrock autoload fix is a good example: confirm the provider does not load when only `AWS_REGION` is set.
- Preserve commit bodies. The old `birdhouse` branch commit body is the source of truth; update wording only where the implementation path changed.
- Do not start with a full baseline CI pass. Port the next commit, then run CI; baseline failures will surface naturally.
- When doing end-of-branch cleanup, do not immediately fold fixes into older commits. Create explicit `fixup!` commits first so commit hashes stay stable while you continue grouping changes.
- Keep the BIRDHOUSE base-tag update as a single commit at the end of the stack. Replace or fix up the previous base-update commit instead of accumulating multiple base-bump commits.

## Key Reminders

- Do not use a traditional `git rebase`.
- Use `git cherry-pick` when it is clearly the least risky way to preserve the intended behavior; otherwise port manually.
- Read old diffs from the `birdhouse` branch clone, never modify that clone.
- Stop treating a commit as required the moment you confirm upstream already absorbed it.
- Keep the branch history understandable; small fixups are fine during the pass, but do the final autosquash only after the human has reviewed the `fixup!` commits and approved the cleanup.
