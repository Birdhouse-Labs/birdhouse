# Code Review Standards

This document is an **index** to help you find relevant guidance for your changes. Not everything applies to every change - scan the categories and read what's relevant.

---

## ⚡ Quick Start

**All changes must pass:** `bun run check` (typecheck, lint, test, build)

**For most changes, read:**
- This index (you are here)
- Scan categories below - read what applies to your changes

---

## 📋 Required: Automated Checks

All code must pass `bun run check` which runs:
```bash
bun run typecheck && bun run lint && bun run lint:css && bun run test && bun run build
```

**Quick reference:**
- **Security**: No high/critical vulnerabilities
- **TypeScript**: Strict mode + extra checks (see `tsconfig.json`)
- **Biome Lint**: No unused imports, no `any`, no console.log (see `biome.json`)
- **Theme Vars**: All CSS variables must be used (run `bun run lint:css`)
- **Tests**: All tests pass (`vitest.config.ts`)
- **Build**: Production build succeeds

**Auto-fix:** Run `bun run fix` to auto-fix many lint issues

---

## 📚 Framework & Pattern Guides

### Core Patterns (Common - scan titles to see if relevant)

**[SolidJS Best Practices](./solidjs.md)** - Read when:
- Using signals, effects, memos, or resources
- Creating reactive computations at module level
- Working with component lifecycle
- Handling cleanup and disposal

**[Theme System Integration](./theme-system.md)** - Read when:
- Adding new components with styling
- Using CSS variables
- Supporting dark/light modes
- Adding new theme variants

**[Accessibility](./accessibility.md)** - Read when:
- Building interactive components
- Adding keyboard navigation
- Creating modals, dropdowns, or overlays
- Using ARIA attributes

### Specialized Topics (Read only when applicable)

**[Testing Patterns](./testing.md)** - Read when:
- Writing new tests
- Testing interactive behavior
- Mocking or stubbing dependencies

**[Server Dependency Injection](../../server/docs/DEPENDENCIES.md)** - Read when:
- Implementing server routes
- Using OpenCode client or other dependencies
- Need to understand AsyncLocalStorage DI pattern

**[Server Testing](../../server/docs/TESTING.md)** - Read when:
- Writing server tests
- Testing routes or event handlers
- Mocking OpenCode API or dependencies

**[Performance](./performance.md)** - Read when:
- Handling large lists (1000+ items)
- Complex computations or frequent updates
- Optimizing render performance

**[TypeScript Advanced](./typescript.md)** - Read when:
- Writing complex generic types
- Handling discriminated unions
- Advanced type narrowing patterns

---

## 🎯 How to Use This Guide

1. **Scan the categories above** - Do any apply to your changes?
2. **Read relevant guides** - Each is focused and quick to scan
3. **Check examples** - Guides reference real code in this project
4. **Verify automated checks pass** - Run `bun run check`

**For reviewers:** Focus on guides relevant to the PR's changes

---

## 🔗 Quick Links

- TypeScript config: `/frontend/tsconfig.json`
- Biome config: `/frontend/biome.json`  
- Vitest config: `/frontend/vitest.config.ts`
- Theme system overview: `/docs/theming.md`
- Example test: `/frontend/src/components/ui/Button.test.tsx`
