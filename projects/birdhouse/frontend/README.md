# Birdhouse Frontend

SolidJS component playground with theming system.

## Development

```bash
cd frontend
bun install
bun run dev          # Start on port 50120
```

## Testing

```bash
bun run test         # Run Vitest tests (42 tests)
bun run test:watch   # Watch mode
```

## Building

```bash
bun run build        # Production build to dist/
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server (port 50120) |
| `bun run test` | Run all tests |
| `bun run test:watch` | Test watch mode |
| `bun run build` | Production build |
| `bun run check` | Full validation (themes, typecheck, lint, test, build) |
| `bun run typecheck` | TypeScript validation |
| `bun run lint` | Biome linter |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run lint:css` | Stylelint CSS validation |

## Theme System

Themes are CSS variable-based with light/dark variants:

```bash
bun run generate:themes    # Generate theme files from definitions
bun run validate:themes    # Validate theme consistency
```

Theme files:
- `src/styles/themes/` - Individual theme CSS files
- `src/styles/themes.css` - Generated combined themes
- `src/theme/themes.ts` - TypeScript theme registry

## Documentation

- [Theming](../docs/theming.md)
- [Code Review](../docs/code-review/CODE_REVIEW.md)
- [SolidJS Patterns](../docs/code-review/solidjs.md)
- [Testing](../docs/code-review/testing.md)
- [Theme System](../docs/code-review/theme-system.md)

## Tech Stack

- **SolidJS** - Reactive UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool + dev server
- **Vitest** - Test runner
- **Tailwind CSS 4** - Utility-first CSS
- **Biome** - Linter + formatter
- **Stylelint** - CSS linter
