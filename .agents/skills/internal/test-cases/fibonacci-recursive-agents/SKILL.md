---
name: fibonacci-recursive-agents
description: Compute Fibonacci numbers using recursive agent delegation where each agent spawns children for sub-problems. Use when you want to run a fibonacci test, recursive fibonacci test, or fibonacci test.
tags:
  - birdhouse
  - test-case
version: 1.0.0
author: Birdhouse Team
metadata:
  internal: true
---

# Fibonacci Recursive Agent Test

Compute fib(n) using recursive agents. Default n=3.

## Your Job

1. Create root agent with **Root Agent Prompt** below
2. Wait for completion
3. Extract result from root agent's response
4. Call agent_tree() yourself
5. Render the tree as nested markdown links

The root agent computes the result. YOU render the tree.

## Root Agent Prompt

```
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

Replace N with the actual number.

## Rendering the Tree

After the root agent completes:

1. Call agent_tree()
2. Find the root agent (it will be at L1, your direct child)
3. Render as nested markdown links (2-space indent per level):

```markdown
- [fib(N)](birdhouse:agent/agent_ABC)
  - [fib(N-1)](birdhouse:agent/agent_DEF)
    - [fib(N-2)](birdhouse:agent/agent_GHI)
  - [fib(N-2)](birdhouse:agent/agent_JKL)
```

Include the root agent and all its descendants. Exclude yourself and unrelated agents.

## Example Output

You should output something like:

```markdown
**fib(3) = 2**

- [fib(3)](birdhouse:agent/agent_A6JMLSRaZ1qySgW_Fm)
  - [fib(2)](birdhouse:agent/agent_fSLB47UmKc3SzyxinY)
    - [fib(0)](birdhouse:agent/agent_haWQJExKcTeGuoNcL5)
    - [fib(1)](birdhouse:agent/agent_7b9ywg4eeqbIWYiXtQ)
  - [fib(1)](birdhouse:agent/agent_f1fDvlg3DpOsHcwjkb)
```

## Overview

Demonstrates recursive agent delegation by computing Fibonacci numbers where each agent spawns children for sub-problems, creating an exponentially growing tree.
