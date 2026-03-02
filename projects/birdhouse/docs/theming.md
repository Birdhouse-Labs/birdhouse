# Theming System

## Three Separate Theme Systems

The app has **three independent theme systems** that can be mixed and matched:

### 1. UI Theme (10 themes)

**Controls:** Backgrounds, borders, buttons, surfaces, gradients  
**Defined in:** `src/index.css` via `[data-theme="..."]` blocks  
**Applied by:** `data-theme` attribute on `<html>` (see `src/theme/context.ts`)  
**Example tokens:** `--theme-surface`, `--theme-border`, `--theme-gradient-from`

### 2. Prose Theme (same 10 themes)

**Controls:** Text colors in markdown/chat content  
**Defined in:** Same `[data-theme="..."]` blocks in `src/index.css`  
**Applied by:** `.prose` container class  
**Example tokens:** `--theme-prose-body`, `--theme-prose-heading`, `--theme-prose-link`

### 3. Code Theme (40+ Shiki themes)

**Controls:** Syntax highlighting colors in code blocks  
**Defined in:** Shiki theme files (external)  
**Applied by:** `resolvedCodeTheme()` passed to Shiki (see `src/demos/CodeBlockDemo/index.tsx`)  
**Managed in:** `src/theme/codeThemes.ts` - maps families to dark/light variants

## Why Three Systems?

**Research finding:** All successful apps (VS Code, Obsidian, GitHub) separate these concerns:

- **VS Code:** `workbench.*` (UI) vs `editor.*` (prose) vs `editor.tokenColorCustomizations` (syntax)
- **Obsidian:** Theme CSS for UI/text, separate code theme setting
- **GitHub:** Site theme vs markdown theme vs syntax highlighting

**Benefits:**
1. Users can pair any UI theme with any code theme
2. Code theme can auto-switch dark/light independently
3. Adding new code themes doesn't require updating UI themes
4. Clear separation of concerns in codebase

## Design Decisions (Research-Based)

### Why Container-Level Styling?

Research found all successful apps (VS Code, Obsidian, GitHub) apply prose styling at the container level, not per-element.

**Pattern:** See `src/index.css` - `.prose` class applies all text styling once.

**Rejected approach:** Per-element classes like `prose-p:text-body prose-li:text-body` (verbose, error-prone).

### Why Inline Code in Prose Theme?

Inline code (`like this`) is styled by prose theme, but code blocks use the code theme.

**Decision:** Inline code is part of the prose text flow - it appears mid-sentence, should match the text styling system.

**Code blocks** are distinct content islands requiring language-specific syntax highlighting (JavaScript keywords vs Python keywords vs Rust keywords).

**Implementation:** See `src/index.css` - `.prose code:not(pre code)` targets only inline code.

### Text Hierarchy: 3 Levels

Research showed 3-tier text system is industry standard (VS Code, Obsidian, GitHub):

1. `--color-prose-body` - Primary content
2. `--color-prose-secondary` - Metadata, timestamps
3. `--color-prose-muted` - Hints, placeholders

**Not 2 levels:** Too little distinction.  
**Not 4+ levels:** Diminishing returns, rarely used.

### Single Heading Color (Initially)

**Research findings:**
- Notion, iA Writer, Discord, Slack: No per-level heading colors
- VS Code: Has per-level, but it's advanced/niche
- Obsidian: Has H1-H6, but themes rarely use all 6

**Decision:** Start with `--color-prose-heading` for all headings. Can add `--color-prose-h1`, `--color-prose-h2`, etc. later with fallback:

```css
--color-prose-h1: var(--theme-prose-h1, var(--theme-prose-heading));
```

Existing themes continue working without changes.

### Font Defaults Pattern

Themes can specify fonts, but defaults are provided:

```css
:root {
  --font-prose-body-default: 'Inter', system-ui, sans-serif;
  --font-prose-code-default: ui-monospace, 'Monaco', monospace;
}

@theme inline {
  --font-prose-body: var(--theme-font-prose-body, var(--font-prose-body-default));
}
```

**Why:** Not every theme needs custom fonts. iA Writer proved 2-3 font families is sufficient.

## Reference Implementations

**Best examples in codebase:**

1. **Theme definition:** See `[data-theme="purple-dream-dark"]` in `src/index.css` - shows all required tokens
2. **Container styling:** See `.prose` rules in `src/index.css` - single point of control
3. **Usage:** See `MessagesDemo.tsx` and `MarkdownDemo.tsx` - just `class="prose"`, no conditionals

## Token Reference

All tokens documented inline in `src/index.css` at the `@theme inline` block.

### Text Color Tokens (Required)

- `--theme-prose-body` - Primary text color
- `--theme-prose-secondary` - Less prominent text (metadata, timestamps)
- `--theme-prose-muted` - Subtle text (placeholders, hints)
- `--theme-prose-heading` - All headings (H1-H6)

### Interactive Tokens (Required)

- `--theme-prose-link` - Link default color
- `--theme-prose-link-hover` - Link hover/focus color

### Inline Code Tokens (Required)

- `--theme-prose-code-inline-text` - Text color for `inline code`
- `--theme-prose-code-inline-bg` - Background color (usually low opacity)

### Optional Tokens

- `--theme-font-prose-body` - Body font family (falls back to Inter)
- `--theme-font-prose-code` - Code font family (falls back to monospace)

### Background Colors

**Not in prose theme.** Backgrounds are controlled by:
- Message/chat UI (separate system)
- Code blocks (code theme system)
- Root background (separate from prose)

**Why:** Research showed prose themes control text appearance only. VS Code, Obsidian separate background tokens from text tokens.

## Creating Themes

1. Copy existing theme block in `src/index.css`
2. Adjust colors (test contrast at https://webaim.org/resources/contrastchecker/)
3. WCAG AA minimum: 4.5:1 for body/secondary, 3:1 for large headings

## Inline Code vs Code Blocks

**Inline code** (`--color-prose-code-inline-*`): Part of prose flow, theme controls it.

**Code blocks**: Separate code theme system handles syntax and backgrounds.

**Why:** Research showed this separation in all apps (GitHub, Discord, Obsidian tie code block backgrounds to syntax theme, not prose theme).
