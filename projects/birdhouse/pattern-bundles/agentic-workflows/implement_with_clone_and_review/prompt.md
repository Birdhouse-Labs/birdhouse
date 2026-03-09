# Implement Plan: Clone and Review

**CRITICAL:** This workflow creates a save point via cloning, then branches for implementation and review. This keeps your context clean while enabling parallel exploration and thorough review.

## When to Use This Skill

Use this workflow when:
- You have a clear plan that needs implementation
- The implementation will consume significant context
- You want independent review with fresh eyes
- You need a save point to branch from multiple times

## The Four-Phase Workflow

### Phase 1: Create the Save Point

**Clone yourself to create a branch point:**

```javascript
agent_create({
  from_self: true,
  title: "Save Point Before Implementation",
  prompt: `You've been cloned as a save point. Your next message will define your task and direction.

Use agent_tree() to see your place in the tree if that helps you understand your role.

You may be cloned again to explore different approaches or phases. Be ready for your next message to take you in an unexpected direction.`
})
```

**Wait for this agent to complete** (default behavior). This creates your reusable save point.

### Phase 2: Clone Save Point for Implementation

**Clone the save point to implement the plan:**

```javascript
agent_create({
  from_agent_id: save_point_agent_id,
  title: "[Plan Title] - Implementation",
  prompt: `Time to implement! You have all the plan context from before you were cloned.

CRITICAL:
- If you have questions, ASK and stop. Don't guess.
- Do NOT write summary documents
- When done, reply in chat with:
  * What you implemented
  * Hiccups, surprises, discoveries
  * Context the reviewer should know`
})
```

**Title format:** Use the plan's actual title with " - Implementation" suffix. First words should provide maximum context (e.g., "Authentication System Refactor - Implementation" not "Implementation of Auth Refactor").

### Phase 3: Clone Save Point for Review

**After implementation completes, clone the save point again for review:**

```javascript
agent_create({
  from_agent_id: save_point_agent_id,
  title: "[Plan Title] - Review",
  prompt: `Snap! The plan has been implemented. Review it with fresh eyes.

PROCESS:

1. Read implementation summary: agent_read("${implementation_agent_id}")
2. Review the actual implementation - question the plan itself, not just adherence
3. Find real issues (your job is to identify concerns, but don't make them up)
4. For each concern, spawn a verification agent in parallel
5. Use the phrase: "Strengthen, weaken, or invalidate this concern"
6. After verification: Spawn a separate fix agent for each verified concern (see Phase 4)

EXAMPLE - 3 concerns = 3 parallel verification agents:

\`\`\`javascript
agent_create({
  title: "Verify Error Handling",
  prompt: "Concerned error handling for X doesn't cover edge case Y. Strengthen, weaken, or invalidate this concern."
})

agent_create({
  title: "Verify Performance",
  prompt: "Concerned about performance of Z when N is large. Strengthen, weaken, or invalidate this concern."
})

agent_create({
  title: "Verify Type Safety",
  prompt: "Concerned types for W might allow invalid states. Strengthen, weaken, or invalidate this concern."
})
\`\`\``
})
```

### Phase 4: Fix and Re-Verify

**After verification agents complete, spawn fix agents ONE AT A TIME for each verified concern.**

**CRITICAL: Fix agents must run SERIALLY, not in parallel.** Wait for each fix agent to get approval from its verifier before spawning the next one.

Each fix agent works with its verification agent in a tight feedback loop:

```javascript
// For FIRST verified concern, spawn a fix agent linked to its verifier
agent_create({
  title: "Fix XSS Vulnerability in Agent Title Rendering",
  prompt: `Fix the XSS vulnerability identified by your verification agent.

**Your verification agent:** agent_abc123
**Their concern:** ${concernSummary}

PROCESS:
1. Read their full verification: agent_read("agent_abc123")
2. Ask them questions about the concern BEFORE implementing
3. Propose your fix approach and get their feedback: agent_reply({ agent_id: "agent_abc123", message: "Planning to fix via X approach. Does this address your concern? Any edge cases?" })
4. Implement the fix
5. Get final sign-off: agent_reply({ agent_id: "agent_abc123", message: "Implemented fix. Please review: [summary]. Does this fully address your concern?" })

You MUST get explicit approval ("✅ Approved" or similar) from the verification agent before considering this complete.

If they identify issues, fix and ask for re-review. Iterate until approved.`
})

// Wait for approval, THEN spawn next fix agent for second concern
// Continue serially until all concerns are fixed and approved
```

**Why separate fix agents (run serially):**
- ✅ Each fix agent focuses on ONE concern (cleaner context)
- ✅ Fix agent discusses approach with verifier before implementing
- ✅ Verifier must explicitly approve the fix
- ✅ Serial execution prevents fixes from conflicting with each other
- ✅ Review agent can track progress and ensure all fixes are approved before final sign-off

## Complete Example

```javascript
// Phase 1: Create save point
const savePoint = agent_create({
  from_self: true,
  title: "Save Point Before Implementation",
  prompt: "You've been cloned as a save point. Your next message will define your task. Use agent_tree() to see your place in the tree."
});

// Phase 2: Implement
const implementation = agent_create({
  from_agent_id: savePoint.id,
  title: "Authentication Refactor - Implementation",
  prompt: "Time to implement! If you have questions, ask and stop. When done, summarize what you built, surprises, and context for the reviewer."
});

// Phase 3: Review (spawns verifiers, then fix agents)
const review = agent_create({
  from_agent_id: savePoint.id,
  title: "Authentication Refactor - Review",
  prompt: `Snap! It's implemented. Review with fresh eyes.

1. Read summary: agent_read("${implementation.id}")
2. Find real concerns and spawn verification agents in parallel
3. Use phrase: "Strengthen, weaken, or invalidate this concern"
4. After verification: Spawn SEPARATE fix agent for each concern
5. Each fix agent must get sign-off from its verifier
6. Collect all sign-offs before final approval`
});

// Review agent spawns verifiers in parallel:
// - Verification Agent 1: "Strengthen/weaken/invalidate XSS concern"
// - Verification Agent 2: "Strengthen/weaken/invalidate SQL injection concern"

// Then spawns fix agents SERIALLY (one at a time):
// 1. Fix Agent 1 ↔ Verification Agent 1 (discuss → implement → approve) ✅
// 2. Wait for approval, then Fix Agent 2 ↔ Verification Agent 2 (discuss → implement → approve) ✅

// Review agent collects all sign-offs and gives final approval
```

## Why This Works

**Clean context:** Each agent has focused context from when the plan was made, without context drift.

**Fresh eyes:** Review agent starts from the same save point, no implementation bias or context drift.

**Independent verification:** Catches hallucinations and feedback that is overly picky or missing the larger picture.

**Communication-first:** Emphasizes asking questions over assumptions

**Parallel efficiency:** Verification agents run simultaneously (fix agents run serially to prevent conflicts)

**Tight feedback loops:** Each fix is validated by the agent that identified the concern

## Key Principles

1. **Titles matter** - First words provide maximum context for scanning
2. **Save points are reusable** - Clone the save point multiple times for different branches
3. **Communication over assumptions** - All agents should ask questions when uncertain
4. **Verification is required** - No issue goes forward without independent validation
5. **Fix-verifier loop** - Each fix agent must get explicit approval from its verifier
6. **One concern per fix agent** - Keeps context clean and focused
7. **Summary in chat** - Implementation agent reports findings in conversation, not files

## Common Mistakes

❌ **Not cloning correctly** - You must specify `from_self` or `from_agent_id` to make a clone!
❌ **Creating save point without waiting** - You need the agent_id before cloning it
❌ **Skipping implementation summary** - Reviewer needs context about what happened
❌ **Review agent not reading implementation summary** - Start with agent_read()
❌ **Spawning verification agents sequentially** - Do them in parallel for efficiency
❌ **Sending unverified concerns** - Every concern needs independent investigation
❌ **Generic titles** - "Implementation" tells you nothing, "Auth System Refactor" does
❌ **Multiple fixes in one agent** - Spawn separate fix agents, one per concern
❌ **Running fix agents in parallel** - Fix agents must run serially to avoid conflicts

## Agent Communication

**Implementation agent has questions?**
- Just ask them in your response and stop working
- Don't try to use agent_reply with parent
- Multiple conversation rounds are expected

**Review agent needs clarification?**
- Ask the implementation agent questions if needed
- Use agent_read() to see their work
- Communication goes down the tree, not up

**Verification agents report findings:**
- They naturally report to their parent (the review agent)
- No special syntax needed - just reply with findings
- Parent waits for all parallel verification agents to complete

**Fix agents collaborate with verifiers:**
- Read verifier's full concern: `agent_read("verifier_id")`
- Ask questions before implementing: `agent_reply({ agent_id: "verifier_id", message: "Question..." })`
- Propose approach: `agent_reply({ agent_id: "verifier_id", message: "Planning to..." })`
- Request final approval: `agent_reply({ agent_id: "verifier_id", message: "Implemented. Does this address your concern?" })`
- Iterate until you get explicit "✅ Approved" or similar
