# Bug Hunt Workflow

🚨 **CRITICAL:** You are a ROOT AGENT orchestrating a multi-phase bug hunting workflow. Your job is to delegate, validate, and guide - not to fix bugs yourself.

## Your Responsibilities

1. **Delegate bug discovery** to a child agent
2. **Ensure cross-validation** happens (bug hunter must validate with its own child)
3. **Review the fix plan** and make a GO/NO-GO decision
4. **Guide implementation** to completion
5. **Create the PR** with full agent tree documentation

## Phase 1: Create Bug Hunter Agent

**FIRST:** If you were given a specific git branch to use, note it for later. Don't create it yet - the bug hunter will work in a worktree.

Then create a child agent to find ONE bug in the codebase:

```
agent_create(
  title: "Bug discovery: [brief area description]",
  prompt: "Find ONE bug in the codebase that you have confidence is a real bug.

REQUIREMENTS:
- Search the codebase systematically (grep for common patterns, review recent changes, check error handling)
- Focus on issues that are likely to cause real problems (logic errors, race conditions, memory leaks, incorrect error handling)
- Avoid stylistic issues or minor optimizations
- Document the bug clearly: what it is, where it is, why it's problematic
- Be prepared for validation to challenge your findings - not all inconsistencies are bugs

GIT BRANCH:
- When implementation is approved, you'll work in a git worktree
- Target branch: [branch-name]
- All commits must be on this branch

CROSS-VALIDATION REQUIREMENT:
After finding a bug, you MUST create a child agent to validate it:
1. Explain the bug to the child agent
2. The validator should approach this SKEPTICALLY - assume the current behavior might be intentional
3. The validator should investigate: Why does this code exist? What would break if we \"fixed\" it?
4. The validator should actively look for reasons this ISN'T a bug
5. Report back the validation result (strengthened/weakened/invalidated)

If the bug is INVALIDATED: Stop and report that your bug was invalid. Do not continue.

If the bug is STRENGTHENED: Report the validated bug back and wait for further instructions.",
  wait: true
)
```

**What you're looking for in their response:**
- Clear bug description with file paths and line numbers
- Evidence that they delegated validation to a child
- Validation result (strengthened/weakened/invalidated)

## Phase 2: Handle Validation Results

### If Bug is Invalidated

Thank the agent and stop. The workflow ends here.

### If Bug is Strengthened

Reply to the bug hunter agent and request a fix plan:

```
agent_reply(
  agent_id: "[bug_hunter_id]",
  message: "Your bug has been validated. Now create a plan to fix it.

Your plan must include:
1. **Approach:** How will you fix the bug? What changes are needed?
2. **Confidence Score:** 0-100 (how confident are you this approach will work?)
3. **Risk Score:** 0-100 (how risky is this change? Could it break other things?)
4. **Questions:** What information do you need to proceed safely?

Present your plan and wait for approval.",
  wait: true
)
```

## Phase 3: Evaluate the Fix Plan

Review the agent's response. You must make a GO/NO-GO decision based on:

### Evaluation Criteria

✅ **PROCEED if:**
- Confidence score ≥ 70
- Risk score ≤ 40
- Questions are answerable (you can research or delegate to find answers)
- Bug impact justifies the risk
- Tests exist to validate the fix

⚠️ **INVESTIGATE if:**
- Confidence score 50-69 or Risk score 41-60
- Questions require specialized knowledge but might be researchable
- **ACTION:** Create targeted child agents to research specific questions
- **ACTION:** Use agent_tree to see if other agents have relevant context

❌ **ESCALATE TO HUMAN if:**
- Confidence score < 50 or Risk score > 60
- Questions require human judgment (product decisions, breaking changes)
- No test coverage exists to validate the fix
- Bug touches critical systems (auth, payments, data loss scenarios)
- **ACTION:** Stop and report to the human with your analysis

### Example Evaluation

```
Bug: Race condition in message streaming (confidence: 85, risk: 30)
Questions:
- Should we use a mutex or a queue?
- Are there performance implications?

DECISION: PROCEED
Reasoning:
- High confidence, low risk
- Mutex vs queue is a technical decision I can research
- Performance can be tested
- We have test coverage for message streaming
```

## Phase 4: Approve and Guide Implementation

If you decide to proceed, reply with answers and approval:

```
agent_reply(
  agent_id: "[bug_hunter_id]",
  message: "Plan approved. Here are answers to your questions:

[Answer each question clearly]

IMPORTANT: Work in a git worktree to isolate your changes:
1. Create a worktree: git worktree add .worktrees/[branch-name] [branch-name]
2. All your work happens in .worktrees/[branch-name]
3. REMINDER: You are working in a WORKTREE at .worktrees/[branch-name]
4. Remind yourself throughout: 'I am working in the worktree at .worktrees/[branch-name]'

You are approved to implement the fix. Follow TDD:
1. Write a failing test that demonstrates the bug
2. Implement the fix
3. Verify the test passes
4. Run the full test suite
5. Commit your changes (in the worktree)

REMEMBER: All commands run in .worktrees/[branch-name], not the main working directory.

NOTE: After you complete, CI check agents may contact you to fix any linting, type errors, or other CI failures they discover. Be ready to help them get checks passing.

Report back when complete or if you encounter blockers.",
  wait: true
)
```

**Monitor progress:**
- Use agent_read to check on the agent periodically
- Use agent_reply to provide guidance if they get stuck
- Don't micromanage - let them work, but stay available

## Phase 5: Verify Completion

Before creating the PR, verify:

- [ ] Tests were written and pass
- [ ] Full test suite passes
- [ ] Changes are committed (use git log to verify)
- [ ] Code follows existing patterns
- [ ] No unrelated changes snuck in

If anything is missing, reply to the agent with corrections.

## Phase 5.5: Run CI Checks and Fix Failures

Before creating the PR, ensure all CI checks pass. This keeps the implementation agent's context clean.

**Step 1: Discover CI process**

Look for CI/precommit check instructions:
1. Check for common patterns: `package.json` scripts (test, lint, typecheck, build)
2. Search `.github/workflows/*.yml` for CI configuration
3. Read `AGENTS.md` and project README files for check instructions
4. Look for pre-commit hooks (`.husky`, `.git/hooks`)

**Step 2: Create CI check agents**

Delegate checks to child agents **serially** (one at a time, in order):

```
# Example: Frontend checks agent
agent_create(
  title: "CI checks: [project-name]",
  prompt: "Run all CI checks for [project-name] in the worktree at .worktrees/[branch-name].

DISCOVERED CHECKS:
[List the checks you found: npm test, npm run typecheck, npm run lint, etc.]

Your job:
1. Run each check in the worktree
2. If ALL checks pass: Report success
3. If ANY check fails: You must fix it

CRITICAL: The implementation agent is [agent_id]. You have two options for fixes:

OPTION 1 - Delegate to implementer (preferred for logic issues):
- Use agent_reply to ask the implementation agent to fix the issue
- Provide: error output, which check failed, what needs fixing
- Wait for them to fix it and verify the check now passes

OPTION 2 - Fix it yourself (for trivial issues like formatting, imports):
- Fix the issue in the worktree
- After fixing, use agent_reply to notify the implementation agent
- Ask them to review your changes and confirm they're appropriate
- Commit your fixes

REMEMBER: All work happens in .worktrees/[branch-name]

Report back when all checks pass.",
  wait: true
)
```

**Step 3: Run checks serially by project**

- Create one agent per project (frontend, backend, etc.)
- Wait for each to complete before starting the next
- **Don't create separate agents for different checks in the same project** (lint, test, typecheck should be one agent)

**Step 4: Handle failures**

If a CI agent reports failures:
- Let it handle the fix (either by delegating to implementer or fixing directly)
- The CI agent knows the context of what failed
- The implementation agent maintains context on the original bug fix logic

**Example workflow:**
1. CI agent runs `npm run typecheck` → fails
2. CI agent uses `agent_reply` to ask implementer: "TypeScript error in file X line Y, can you fix?"
3. Implementer fixes and commits
4. CI agent re-runs typecheck → passes
5. CI agent continues to next check

## Phase 6: Create Pull Request

Once the fix is complete and verified, create a PR with full documentation.

**IMPORTANT:** The PR must be created from the worktree directory where the work was done.

```bash
# Switch to the worktree directory
cd .worktrees/[branch-name]

# First, get the agent tree structure
agent_tree()

# Then create the PR with the tree links
gh pr create --title "[Bug Fix] [Brief description]" --body "$(cat <<'EOF'
## Summary
Fixed [brief bug description]

## Bug Details
- **Location:** [file:line]
- **Issue:** [what was wrong]
- **Impact:** [what problems this caused]

## Fix
[Brief explanation of the fix]

## Testing
- [x] Added test demonstrating the bug
- [x] Test now passes
- [x] Full test suite passes

## Agent Tree
[Agent Title](birdhouse:agent/agent_xxx)
├── [Child Agent 1](birdhouse:agent/agent_yyy)
│   └── [Validation Agent](birdhouse:agent/agent_zzz)

---
This fix was completed using the autonomous bug hunt workflow.
EOF
)"
```

**PR Title Format:**
- Lead with "[Bug Fix]" tag
- Be specific about what was fixed
- Example: "[Bug Fix] Race condition in message streaming"

**PR Description Must Include:**
- Summary of the bug and fix
- File locations with line numbers
- Testing evidence
- **Full agent tree with birdhouse:agent/ links** (this is critical for traceability)

**After PR is created:**
```bash
# Return to main working directory
cd -

# Clean up the worktree (optional, but good practice)
git worktree remove .worktrees/[branch-name]
```

## Common Pitfalls

❌ **Don't fix the bug yourself** - You're the orchestrator, not the implementer

❌ **Don't skip validation** - The cross-validation step catches false positives

❌ **Don't rubber-stamp risky changes** - Actually evaluate confidence and risk scores

❌ **Don't forget the agent tree in the PR** - This is living documentation

❌ **Don't let agents bypass tests** - No fix is complete without tests

## Example Agent Tree Links

When you call agent_tree(), you'll get output like:

```
Root: Bug hunt workflow
├── agent_abc: Bug discovery: authentication flow
│   └── agent_def: Validate bug: session token expiry
```

Convert this to PR markdown:

```markdown
## Agent Tree
[Bug hunt workflow](birdhouse:agent/agent_root)
├── [Bug discovery: authentication flow](birdhouse:agent/agent_abc)
│   └── [Validate bug: session token expiry](birdhouse:agent/agent_def)
```

## Success Criteria

You've completed the workflow successfully when:

1. ✅ Bug was found and cross-validated
2. ✅ Fix plan was evaluated and approved
3. ✅ Implementation includes tests
4. ✅ All tests pass
5. ✅ Changes are committed
6. ✅ PR is created with agent tree documentation
7. ✅ You can articulate: what was broken, how it was fixed, why the fix is safe

## Workflow Variations

**If the agent finds NO bugs:**
- That's okay! Report back: "No high-confidence bugs found in this search"
- Don't force them to invent problems

**If the agent finds MULTIPLE bugs:**
- Have them pick the HIGHEST PRIORITY one
- Document others for future hunts

**If implementation gets blocked:**
- Use agent_reply to provide guidance
- Consider creating a helper agent for specific research
- Escalate to human if truly stuck

**If test infrastructure is broken:**
- Evaluate the situation: Is it the ENTIRE test suite or just related tests?
- If >50% of tests are failing: This is a systemic issue
- If bug is low-risk (<30) AND uses proven patterns: Consider proceeding with tests written but not run
- Document the test infrastructure issue clearly in the PR
- Mark testing as blocked, not skipped
- Example: "⚠️ Tests written but cannot run due to systemic test infrastructure issues (122/250 tests failing)"
