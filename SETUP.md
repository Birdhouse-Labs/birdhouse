# Development Setup

This guide is for contributors building Birdhouse from source. If you just want to use Birdhouse, see the [Installation section in the README](./README.md#installation).

## Prerequisites

- [Bun](https://bun.sh) v1.1 or later
- [Birdhouse's OpenCode fork](https://github.com/Birdhouse-Labs/opencode) cloned locally
- An API key for at least one supported provider (Anthropic, OpenAI, etc.)

## Setup

```bash
# Clone the repo
git clone git@github.com:Birdhouse-Labs/birdhouse.git
cd birdhouse

# Install dependencies
cd projects/birdhouse
bun install
cd frontend && bun install
cd ../server && bun install

# Install plugin dependencies
cd ../../birdhouse-oc-plugin && bun install
```

Set `OPENCODE_PATH` to your local OpenCode clone:

```bash
export OPENCODE_PATH=/path/to/opencode
```

## Running in development

```bash
cd projects/birdhouse
bun run dev
```

This starts the frontend and server with hot reload. Open `http://localhost:50100` to see the UI.

## Running checks

```bash
bun run check:all
```

Individual checks:

```bash
bun run check:frontend   # typecheck, lint, css lint, tests, build
bun run check:server     # typecheck, lint, tests, build
bun run check:plugin     # typecheck, tests, build
```

## Building the CLI

```bash
OPENCODE_PATH=/path/to/opencode BIRDHOUSE_VERSION=dev bun run build:cli
bash scripts/install-cli.sh
```

This builds and installs to `~/.birdhouse/`. Make sure `~/.birdhouse/bin` is on your `PATH`.

## Port configuration

| Service | Default port |
|---------|-------------|
| Birdhouse server + frontend | 50100 |
| OpenCode (per workspace) | 50110+ |

Override with `BIRDHOUSE_BASE_PORT` if you need a different range.
