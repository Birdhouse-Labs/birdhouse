# Fibonacci Recursive Agent Test

Compute `fib(n)` using recursive agents. Default `n=3`.

## Purpose

This validates recursive agent creation and tree formation. It is strongest at testing `agent_create` and agent-tree structure.

## Procedure

1. Create a root agent with the root prompt below.
2. Wait for completion.
3. Extract the final Fibonacci result.
4. Call `agent_tree()` yourself.
5. Render the tree as nested markdown links.

The root agent computes the result. You render the tree.

## Root Prompt

```text
You are computing fib(N) recursively.

STEP 1 - Check your N:
- If N is 0: your answer is 0. Report it and stop. DO NOT create any child agents.
- If N is 1: your answer is 1. Report it and stop. DO NOT create any child agents.
- If N >= 2: you MUST spawn two child agents (one for fib(N-1) and one for fib(N-2)). You are NOT allowed to compute these yourself. You MUST use child agents.

STEP 2 (only if N >= 2) - Spawn both child agents using this exact prompt template (replace X with the actual number):
---
You are computing fib(X) recursively.

STEP 1 - Check your X:
- If X is 0: your answer is 0. Report it and stop. DO NOT create any child agents.
- If X is 1: your answer is 1. Report it and stop. DO NOT create any child agents.
- If X >= 2: you MUST spawn two child agents (one for fib(X-1) and one for fib(X-2)). You are NOT allowed to compute these yourself. You MUST use child agents.

STEP 2 (only if X >= 2) - Spawn both child agents using this same prompt template with the appropriate numbers.

STEP 3 (only if X >= 2) - Wait for both children, then add their results: fib(X) = fib(X-1) + fib(X-2).

Report: "I spawned [fib(A)](birdhouse:agent/agent_XXX) and [fib(B)](birdhouse:agent/agent_YYY) and added their results: fib(X) = Z"

**fib(X) = Z**
---

STEP 3 - Wait for both children, then add their results: fib(N) = fib(N-1) + fib(N-2).

Report: "I spawned [fib(A)](birdhouse:agent/agent_XXX) and [fib(B)](birdhouse:agent/agent_YYY) and added their results: fib(N) = Z"

**fib(N) = Z**
```

Replace `N` with the actual number.

## Expected Output Shape

```markdown
**fib(3) = 2**

- [fib(3)](birdhouse:agent/agent_A)
  - [fib(2)](birdhouse:agent/agent_B)
    - [fib(0)](birdhouse:agent/agent_C)
    - [fib(1)](birdhouse:agent/agent_D)
  - [fib(1)](birdhouse:agent/agent_E)
```

## Notes

- This is excellent for validating recursive agent creation.
- It does not meaningfully exercise `agent_reply`, `agent_read`, or `agent_read_tool_call`.
