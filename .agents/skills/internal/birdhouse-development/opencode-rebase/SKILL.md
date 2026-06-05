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

1. **Pre-flight**: Before creating the worktree, do a structural diff between the old base tag and the new one. Identify files that moved, were deleted, or were significantly rewritten. This pays for itself on every medium-risk commit — you'll know which ports need manual work before you start.
2. Create a worktree from the new upstream tag.
3. Read `BIRDHOUSE.md` and build the commit checklist.
4. Run `bun install` in the worktree root.
5. If the fork uses the built-in Birdhouse plugin, copy `packages/opencode/src/plugin/birdhouse.ts` into the worktree before validation.
6. Review each commit against upstream before applying it; skip absorbed fixes.
7. Port one commit at a time: read old diff, map intent to current files, apply, run CI, commit.
8. Create a backup branch before squash cleanup.
9. After the full pass, squash cleanup commits, keep prompt commits separate, and update `BIRDHOUSE.md`.

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
   - Check whether the files touched by the old commit still exist in the new worktree. If a file is missing, search by the exported symbol name or error type — not by the old path. Upstream restructuring is common; the behavior lives somewhere new.
   - Read the corresponding files in the new worktree.
   - Check whether upstream already absorbed the behavior. Search for the function name, constant, or error type from the old diff — not for the literal lines. If you find the same logic already present, drop the commit. If you find similar-looking code that differs in a load-bearing way, keep it.
   - Drop absorbed commits without ceremony.

7. Apply commits one at a time.
   - Read the old diff.
   - State the load-bearing intent in one sentence.
   - Read the current file layout in the new worktree.
   - Recreate the behavior in the current architecture.
   - Prefer `git cherry-pick` when it applies cleanly and the behavior is still obviously correct.
   - Port manually when the commit conflicts or the surrounding implementation has moved enough that cherry-pick would hide important judgment.
   - **Before writing new test code**, read an existing test in the same directory to learn the current test patterns and helper utilities. The test infrastructure changes across upstream versions; copying the wrong pattern wastes a CI cycle.
   - **If the commit adds a server route**, regenerate the SDK files after porting all server-side changes for that commit. Do not hand-edit the gen files — run the generator instead so the output is guaranteed correct. Use the clean-env wrapper with `OPENCODE_XDG_*` set so the generator's sqlite migration writes to a temp dir and does not touch any live opencode data:
     ```bash
     tmp_data="$(mktemp -d)" tmp_cfg="$(mktemp -d)" tmp_state="$(mktemp -d)" tmp_cache="$(mktemp -d)"
     env OPENCODE_XDG_DATA_HOME="$tmp_data" \
         OPENCODE_XDG_CONFIG_HOME="$tmp_cfg" \
         OPENCODE_XDG_STATE_HOME="$tmp_state" \
         OPENCODE_XDG_CACHE_HOME="$tmp_cache" \
       bun ./packages/sdk/js/script/build.ts
     ```
     Run this from the worktree root. The generator calls `bun dev generate` inside `packages/opencode`, which builds the OpenAPI spec from the in-memory route registry — it does not start a server or bind any port. The only side effect is a one-time sqlite migration to the temp dirs. After generation, `git diff packages/sdk` shows exactly what changed.
   - Run CI.
   - Commit with the same subject line.
   - Copy the original commit body for non-trivial commits and update details that changed.

8. Run CI from the worktree root only.
   The documented fork commands live in `BIRDHOUSE.md` in the repo root. Start there.

   If the fork has `script/test-clean-env.sh`, use it — it handles clean env, repo-local turbo, and the birdhouse.ts check in one call:
   ```bash
   ./script/test-clean-env.sh typecheck
   ./script/test-clean-env.sh test
   ```

   Run typecheck before tests. The birdhouse plugin tests delete `packages/opencode/src/plugin/birdhouse.ts` in their teardown. Running typecheck first means it sees the file; running tests last means the deletion is harmless. If you need to run typecheck again after tests, re-copy the plugin source first.

   If the script does not exist yet (it is itself one of the commits to port), fall back to the repo-local turbo binary directly:
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
   - Run the SDK generator one final time as a sanity check. If `git diff packages/sdk` is empty after generation, the hand-ported and generated outputs matched throughout the rebase. If there is a diff, apply it as a fixup before finalizing.
   - Update the base tag in `BIRDHOUSE.md`.
   - Verify `git status --short` is empty.

12. Tag and publish.
   - Tag the **previous** birdhouse branch tip before overwriting it: `git tag birdhouse/v<old-version> <old-tip-branch-or-commit>`. This preserves the full history of prior rebases as navigable tags.
   - Tag the **new** tip: `git tag birdhouse/v<new-version> birdhouse-v<new-version>`.
   - Reset the `birdhouse` branch to the new tip: `git checkout birdhouse && git reset --hard birdhouse-v<new-version>`.
   - Delete the working branch — it's now fully captured in the tag: `git branch -D birdhouse-v<new-version>`.
   - If the sandbox worktree (`.worktrees/opencode-birdhouse`) was on the working branch, switch it to detached HEAD at the tag: `git -C .worktrees/opencode-birdhouse checkout --detach birdhouse/v<new-version>`.
   - Run `bun install` in the main clone root before pushing — the pre-push hook runs a full monorepo typecheck and will fail with stale SDK dist if skipped.
   - Force-push the branch: `git push labs birdhouse --force`.
   - Push all new tags: `git push labs birdhouse/v<old-version> birdhouse/v<new-version>`.

   **Tagging convention:** `birdhouse/v<upstream-base-version>` — e.g. `birdhouse/v1.4.11`. Version-based, not an incrementing integer. One tag per rebase, pointing at the final tip of that rebase's commits.

## Commits To Review Before Applying

Do not hardcode historical skip lists into the workflow. Instead, look for the same patterns each time:

- Check whether the files touched by the old commit still exist in the new worktree. Missing files mean the behavior moved; find the new home before deciding anything.
- Search for the function name, error type, or constant from the old diff — not for the literal changed lines. That tells you whether the behavior exists, not just whether the file changed.
- Compare the old diff's intent against the current implementation.
- Skip the commit if the relevant behavior is already present upstream.
- Keep the commit if the code looks similar but the behavior still needs explicit verification.
- Be especially careful with provider, plugin, and prompt commits; they are the most likely to look absorbed while still differing in behavior.

## Gotchas

- Do not trust ambient machine state. Provider/config tests can fail from real local auth, config, or XDG paths. Use the clean-env CI wrapper.
- Do not run `bun run typecheck` or `bun test` inside `packages/opencode`. That produces stale-SDK failures.
- Run `bun install` in the worktree root before the first CI run. Missing local tools like `tsgo` can make clean-env CI fail for setup reasons unrelated to the port.
- If `bun turbo ...` fails because Bun tries to run `turbo.json`, use `./node_modules/.bin/turbo ...` from the worktree root.
- Do not mirror old file paths blindly. When a file from the old diff is missing in the new worktree, search for the exported symbol, type name, or function name to find where it moved. Reapply intent, not line numbers.
- Check prompt files broadly. Upstream may rename or proliferate prompt files across versions; clean all active prompt variants, not just the files touched in the old commit.
- Treat built-in Birdhouse plugin support carefully. The plugin name may be configured as `birdhouse`, but the runtime import and entry handling may need adaptation to the current plugin loader.
- For built-in Birdhouse plugin support, typecheck/build validation may require the ignored `packages/opencode/src/plugin/birdhouse.ts` file to exist locally in the worktree.
- Validate behavior, not just diff shape. The Bedrock autoload fix is a good example: confirm the provider does not load when only `AWS_REGION` is set.
- Preserve commit bodies. The old `birdhouse` branch commit body is the source of truth; update wording only where the implementation path changed.
- Do not start with a full baseline CI pass. Port the next commit, then run CI; baseline failures will surface naturally.
- When doing end-of-branch cleanup, do not immediately fold fixes into older commits. Create explicit `fixup!` commits first so commit hashes stay stable while you continue grouping changes.
- Keep the BIRDHOUSE base-tag update as a single commit at the end of the stack. Replace or fix up the previous base-update commit instead of accumulating multiple base-bump commits.

## Agentic Tests

After the full port and CI pass, run the agentic test suite against the new worktree to confirm the rebased opencode works end-to-end in a real Birdhouse session.

Load the `birdhouse-agentic-tests` skill (at `file:///Users/crayment/dev/birdhouse-workspace/.agents/skills/internal/birdhouse-development/birdhouse-agentic-tests/SKILL.md`). Run all tests and confirm every test passes before considering the rebase done.

**Important:** start sandbox1 with the rebase worktree path, not the default:
```bash
bash sandboxes/start-sandbox.sh --sandbox sandbox1 \
  --opencode-path /tmp/opencode-v<version>
```
Replace `<version>` with the new upstream tag (e.g. `1.4.12`). This runs the tests against the in-progress rebase, not the already-merged `birdhouse` branch. The default opencode path (`.worktrees/opencode-birdhouse`) points at the merged branch and would not test your new work.

## Key Reminders

- Do not use a traditional `git rebase`.
- Use `git cherry-pick` when it is clearly the least risky way to preserve the intended behavior; otherwise port manually.
- Read old diffs from the `birdhouse` branch clone, never modify that clone.
- Stop treating a commit as required the moment you confirm upstream already absorbed it.
- Keep the branch history understandable; small fixups are fine during the pass, but do the final autosquash only after the human has reviewed the `fixup!` commits and approved the cleanup.
