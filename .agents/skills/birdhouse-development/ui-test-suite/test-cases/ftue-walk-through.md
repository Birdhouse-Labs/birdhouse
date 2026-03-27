# Test Case: First-Time User Experience Walk-Through

## What this tests

The complete journey a brand new user takes from opening Birdhouse for the first time through successfully launching their first agent — including profile setup, workspace creation, the booting screen, API key configuration, and agent launch.

## Starting state

Fresh Birdhouse install with an empty `data.db` — no profile, no workspaces, and no providers configured. The runner provides a fresh workspace directory for this run and opens Birdhouse on the setup flow for that directory, mirroring what `birdhouse ui` does for a new location.

## User goals

Walk through this as a real user encountering Birdhouse for the first time, trying to:

1. Set up their profile (enter their name)
2. Create their first workspace in the directory the runner provided
3. Observe the workspace booting screen — what does the user see while OpenCode starts?
4. Try to launch a first agent before configuring any provider and note what guidance Birdhouse gives
5. Find where to configure an AI provider and add a Google AI (Gemini) API key through the UI
6. Return to the workspace and launch a first agent with a simple message ("Tell me a fun fact")
7. Observe what the user sees while the agent runs and after it completes

## What passing looks like

- Profile setup completes and navigates forward without error
- Workspace is created and the booting screen appears (not a blank spinner)
- The booting screen transitions to the workspace view once OpenCode is ready
- Before a provider is configured, Birdhouse makes it clear why agent launch cannot proceed and how to fix it
- The user can find and configure an AI provider without needing documentation
- A model appears in the model selector after adding the provider
- **OpenCode Zen built-in models are still visible in the model selector after adding a provider** — they must not disappear when a user-configured provider is added
- An agent launches successfully and produces a response
- No step requires a page refresh to recover from a broken state

## Things to pay attention to

- **Booting screen** — Does it communicate clearly that OpenCode is starting? Or does it feel broken? Note how long it takes and whether the messaging is reassuring.
- **API key discoverability** — How many clicks does it take to find where to add a provider? Is it obvious to a new user that this is required before anything works?
- **Model selector after adding a provider** — Does it immediately show Gemini models? Or does it still show all providers including unconfigured ones (Anthropic, OpenAI, etc.)?
- **OpenCode Zen models must survive provider addition** — After adding Google AI, explicitly open the model selector and confirm OpenCode Zen built-in models (e.g. Big Pickle) are still present alongside Gemini models. If they have disappeared entirely, that is a 🔴 blocker regression.
- **Agent title generation** — Does the agent get a title after completion, or does it get stuck on "Creating Agent..."? (Known issue with some providers.)
- **Overall flow** — Does it feel like a guided experience, or does the user have to discover each step on their own?

## Known intentional behaviours

- **OpenCode built-in models appear without any provider configured** — Birdhouse ships with a set of free "OpenCode Zen" models that are always available. These appearing in the model dropdown before any provider is added is expected, not a bug.
- **Non-chat models appear in the model dropdown** — TTS, image generation, embedding, and live audio models from Google AI (and other providers) appear alongside chat models. This is intentional parity with OpenCode's model list. Tracked in [Birdhouse-Labs/birdhouse#44](https://github.com/Birdhouse-Labs/birdhouse/issues/44) for future improvement.
- **Many Gemini model variants with no recommended indicator** — After adding a Google AI provider, 30+ Gemini variants appear with no guidance on which to pick. This is a known UX gap, also tracked in issue #44.

## API keys / credentials needed

The person running this test must supply a valid Google AI (Gemini) API key. Pass it in the agent prompt. The test agent should enter it through the UI — do not pre-seed it via the API.
