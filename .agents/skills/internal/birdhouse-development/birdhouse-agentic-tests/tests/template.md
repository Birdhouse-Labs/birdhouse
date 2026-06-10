# <Test Name>

## Description

<One or two sentences describing what this test covers at a high level.>

## What this tests

- <Specific behavior 1>
- <Specific behavior 2>
- <Add as many as needed>

## Prerequisites

- Environment selection, sandbox ownership checks, workspace resolution, and recording setup are owned by the top-level skill runner
- <If the test launches or interacts with OpenCode agents, add any feature-specific prerequisite here>
- <Any additional prerequisites, e.g. "API key configured for Anthropic">

## Timeout

<N> minutes from <starting point, e.g. "the time the message is sent">.

## Model selection

<Remove this section if the test does not launch an agent. Otherwise specify model requirements or use the default: "First choice Big Pickle, second choice any model with 'free' in its name.">

## Steps

1. Create a timestamped run directory:
   ```bash
   RUN_DIR="<run-dir>"
   ```

2. Navigate to the workspace agents page:
   `<base-url>/#/workspace/<workspace-id>/agents`

3. Save screenshot `$RUN_DIR/01-start.png` once the page has loaded.

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

## Notes for test authors

- Use runner-provided values like `<base-url>`, `<workspace-id>`, `<workspace-root>`, `<run-dir>`, `<session-name>`, and `<model-name>` when needed.
- If the test needs fixture files, create them under `<workspace-root>` or another runner-provided workspace path during the browser-driven flow.
- Do not derive environment details from local sandbox sqlite files.
- Do not hardcode `sandbox1`, `sandbox2`, or fixed ports inside the test body unless the specific feature under test is port-related.
