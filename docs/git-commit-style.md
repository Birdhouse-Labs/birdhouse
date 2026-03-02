# Git Commit Style Guide

## Philosophy: Subject-First Commits

**Lead with what changed, not how you changed it.**

When scanning `git log --oneline`, GitHub commit lists, or browser tabs with git diffs, the first few words are all you see. Make them count.

## Core Principles

1. **Lead with the subject/topic** - What part of the codebase changed?
2. **Keep technical terms exact** - File names, API names, component names, error codes
3. **Remove filler words** - the, this, my, a, an
4. **Think searchability** - What would you `git log --grep` for?
5. **First ~60 characters matter most** - Git UIs often truncate here
6. **Length is fine when it adds context** - Don't artificially constrain

## Examples

### Basic Transformations

```
❌ "Refactor database schema"
✅ "Database schema - add agent_patterns table with versioning"

❌ "Fix authentication bug"
✅ "Authentication errors after session refresh"

❌ "Update React hooks implementation"
✅ "React hooks useCallback optimization"

❌ "Add new feature for cloning"
✅ "Session cloning via from_self and from_message_id"

❌ "Improve performance of tree rendering"
✅ "Tree rendering performance - virtualization and memoization"
```

### With Conventional Commit Prefixes

We support conventional commit prefixes (`feat:`, `fix:`, etc), but still lead with the subject:

```
❌ fix: Fix the auth bug
✅ fix: Authentication session refresh errors

❌ feat: Add clone API
✅ feat: Agent clone API with message forking

❌ refactor: Refactor title generation
✅ refactor: Title generation - subject-first approach

❌ test: Add tests for cloning
✅ test: Agent cloning with from_self parameter

❌ docs: Update README
✅ docs: Agent creation workflow in README
```

## Commit Message Structure

### Subject Line (First Line)

```
[prefix: ]<subject-first description>

Examples:
- Database migrations - add agent_patterns table
- fix: Authentication errors after session refresh  
- feat: Agent cloning via from_self parameter
```

**Rules:**
- ~60 characters ideal (can go longer if needed for clarity)
- Lead with the subject, not the action
- No period at the end
- Keep technical terms exact

### Body (Optional, Recommended)

After a blank line, add context:

```
Database migrations - add agent_patterns table

Add new table to store reusable multi-agent workflow patterns. Supports
versioning, metadata, and full-text search on pattern content.

Schema:
- id, name, description, content (JSONB)
- version, created_at, updated_at
- Indexes on name and GIN index for content search

Migration uses raw SQL for precise control over indexes and constraints.
```

**Body guidelines:**
- Explain WHY (motivation, context, trade-offs)
- Link to issues/discussions if relevant
- List specific files changed if it aids understanding
- Include examples of before/after when helpful

## Special Cases

### Breaking Changes

Lead with what broke, prefix with `BREAKING:` or `!`:

```
✅ BREAKING: Agent API response format - parts array renamed to messages
✅ feat!: Authentication - JWT tokens replace session cookies
```

### Reverts

```
✅ revert: Agent cloning feature - unstable with message forking
```

### Multi-Component Changes

When changing multiple unrelated things (avoid if possible):

```
✅ chore: Dependencies update - Bun 1.3.5 and TypeScript 5.7
✅ fix: Authentication errors and agent tree rendering race condition
```

## Why This Works

**Truncation is everywhere:**

| Context | Truncation Point | Subject-First Benefit |
|---------|-----------------|----------------------|
| `git log --oneline` | ~60 chars | "Agent clone API" vs "Implement clone" |
| GitHub commit list | ~72 chars | Scan for relevant changes quickly |
| `git blame` output | ~50 chars | Understand what changed at a glance |
| Git GUI tools | Varies | First words matter most |

**Searchability:**

```bash
# Finding relevant commits is easier
git log --grep "authentication"     # ✅ Finds "Authentication errors..."
git log --grep "implementing"       # ❌ Returns everything

# Better git history navigation
git log --oneline | grep "clone"    # ✅ "Agent clone API..."
git log --oneline | grep "add"      # ❌ Too many generic matches
```

## Quick Checklist

Before committing, ask yourself:

- [ ] Does the first word identify the subject area?
- [ ] Would I find this commit by searching for the subject?
- [ ] Are technical terms (files, APIs, components) exact?
- [ ] Did I remove filler words (the, this, my)?
- [ ] If truncated at 60 chars, is it still meaningful?

## Anti-Patterns to Avoid

```
❌ "Fixed a bug"                    → What bug? Where?
❌ "Updated files"                  → Which files? What changed?
❌ "Implemented new feature"        → Which feature?
❌ "Refactored code"                → What code? Why?
❌ "Made improvements"              → Too vague
❌ "WIP"                            → Not descriptive (use feature branches)
❌ "misc changes"                   → Split into focused commits
```

## When in Doubt

Ask: **"What would I search for to find this commit 6 months from now?"**

That's your commit message.
