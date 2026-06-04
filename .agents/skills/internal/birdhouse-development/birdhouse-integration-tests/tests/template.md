# <Test Name>

## Description

<One or two sentences describing what this test covers at a high level.>

## What this tests

- <Specific behavior 1>
- <Specific behavior 2>
- <Add as many as needed>

## Prerequisites

- sandbox1 running and fork-verified (see SKILL.md environment setup)
- <Any additional prerequisites, e.g. "API key configured for Anthropic">

## Timeout

<N> minutes from <starting point, e.g. "the time the message is sent">.

## Model selection

<Specify any model requirements, or use the default: "Search the model picker for 'free'. Use opencode/big-pickle if available.">

## Steps

1. Navigate to the workspace agents page:
   `http://127.0.0.1:50200/#/workspace/<id>/agents`

2. Take screenshot `01-start.png` once the page has loaded.

3. <Next step. Be specific — exactly what to click, type, or wait for.>

4. Take screenshot `02-<descriptive-name>.png` at a meaningful checkpoint.

5. <Continue steps. Each interaction gets its own numbered step.>

6. Take screenshot `NN-final.png` showing the end state.

## Pass criteria

All of the following must be true:

- <Specific, checkable condition — something visible in the browser UI>
- <Another condition>
- The video file exists and has a non-zero size

## Fail criteria

Any of the following immediately indicates failure:

- <Specific condition that means the test failed>
- <Another failure condition>
- The operation did not complete within the timeout

## Known limitations

<Optional. Document anything about this test that may produce uncertain results or require manual interpretation. If none, remove this section.>
