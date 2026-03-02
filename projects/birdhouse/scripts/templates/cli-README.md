# Birdhouse CLI (Beta)

Multi-agent orchestration platform for agentic software development.

## Installation

**Requirements:**
- macOS (Apple Silicon / ARM64)
- Node.js 18 or later

**Install globally:**

```bash
npm install -g ./birdhouse-cli-0.1.0-beta.1.tgz
```

Or with Bun:

```bash
bun add -g ./birdhouse-cli-0.1.0-beta.1.tgz
```

## Usage

Navigate to your project directory and start Birdhouse:

```bash
cd /path/to/your/project
birdhouse ui
```

This will:
1. Detect or create a workspace configuration
2. Start the OpenCode engine and Birdhouse server
3. Open the Birdhouse UI in your browser at `http://localhost:50190`

**Commands:**

- `birdhouse ui` - Start Birdhouse UI
- `birdhouse --version` - Show version
- `birdhouse --help` - Show help

**Stopping:**

Press `Ctrl+C` in the terminal to stop all Birdhouse processes.

## Workspace Management

Birdhouse creates a `.{dirname}.birdhouse/` directory in your project to store workspace configuration. Each project gets isolated data storage in:

```
~/Library/Application Support/Birdhouse/workspaces/{workspace_id}/
```

This ensures your agent conversations and data are kept separate per project.

## Beta Notes

This is a beta release. Please report issues to the Birdhouse team.

**Current limitations:**
- macOS Apple Silicon only (darwin-arm64)
- Single-user local development
- Ports 50190 and 50192 must be available

## Support

For questions and support during the beta:
- Documentation: https://birdhouse.dev/docs
- GitHub Issues: https://github.com/birdhouse/birdhouse/issues

## License

MIT
