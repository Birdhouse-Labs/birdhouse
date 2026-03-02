# Generate Release Notes from Git Branch

🚨 **CRITICAL:** This pattern analyzes ALL commits since a branch diverged from main and organizes them into user-facing and technical changes. Multiple commits often represent iterations on a single feature - your job is to group them coherently.

## Step 1: Identify the Branch and Check Status

```bash
# Get current branch
git branch --show-current

# Check for uncommitted changes
git status
```

⚠️ **If there are uncommitted changes:** Warn the user but continue. The analysis is read-only.

## Step 2: Fetch and Analyze Commit History

```bash
# Fetch latest from origin
git fetch origin

# Get commit list (use current branch name from step 1)
git log origin/main..<current-branch> --oneline

# Get detailed commit info with dates
git log origin/main..<current-branch> --pretty=format:"%H|%s|%an|%ad" --date=short

# Get overall statistics
git diff origin/main...<current-branch> --stat
git diff origin/main...<current-branch> --shortstat
```

✅ **What to look for:**
- How many commits total?
- How many files changed?
- What's the overall scope (insertions/deletions)?
- Are commits grouped by feature or scattered?

## Step 3: Examine Key Commits in Detail

Don't just read commit messages - examine the actual changes:

```bash
# Show detailed stats for specific commits
git show <commit-hash> --stat

# Look at first and last commits
git log origin/main..<current-branch> --pretty=format:"%H" | tail -1 | xargs git show --stat
git log origin/main..<current-branch> --pretty=format:"%H" | head -1 | xargs git show --stat
```

**Strategy:**
1. Start with commits that seem to introduce new features (based on message)
2. Look for commits that refine/fix those features (iterate on the same files)
3. Identify standalone fixes or improvements
4. Read commit messages for context clues about "why"

**Read actual code when needed:**
- New files/components reveal user-facing features
- Database migrations reveal data model changes
- Test files reveal intended behavior and edge cases
- Pattern files reveal new capabilities

## Step 4: Group Commits into Coherent Changes

**The hard part:** 5-10 commits might represent ONE user-facing feature being developed, refined, and polished.

❌ **Bad grouping:**
```
- Added database column
- Fixed race condition  
- Added UI component
- Fixed positioning bug
- Design tweaks
```

✅ **Good grouping:**
```
**Clone Relationship Tracking**
[User-facing description of the complete feature]

Technical details:
- Database schema changes (commits A, B)
- Event system implementation (commit C)
- UI components (commits D, E, F)
- Bug fixes and polish (commits G, H)
```

**How to group:**
1. **By user impact** - What can users now do that they couldn't before?
2. **By technical area** - Database → Backend → Frontend → Polish
3. **By iteration** - Initial implementation → Refinements → Bug fixes
4. **By files touched** - Commits modifying the same files are often related

**Look for patterns:**
- "Add X" followed by "Fix X" = one feature
- "Implement Y" followed by "Refactor Y" = one improvement
- Multiple commits touching the same component = iterative development

## Step 5: Write Two Versions

### Version 1: Customer-Facing "What's New"

**Tone:** Conversational, benefit-focused, bit of personality

**Structure:**
```markdown
**[Feature Name]**

[1-2 sentence pitch focusing on user benefit and experience]

- [Specific capability 1]
- [Specific capability 2]
- [Specific capability 3]
```

**Rules:**
- Lead with outcomes, not implementation
- Use "you" and "your" 
- Focus on what users can DO now
- Avoid technical jargon
- Keep it scannable (bullets, short paragraphs)

**Example:**
```markdown
## **Clone Relationship Tracking**

See where your agents come from. When you clone an agent, both the original 
and the clone now show the relationship right in the message timeline.

- Click on any agent's timestamp to see its full metadata
- Clone events appear inline with messages
- Agent names are clickable - jump between conversations instantly
- Command-click any agent link to open in a new tab
```

### Version 2: Technical Changes

**Tone:** Precise, contextual, engineering-focused

**Structure:**
```markdown
## **[Technical Feature Name]** *(commits: abc1234, def5678)*

[1 sentence describing the change technically]

*Context:* [Why was this needed? What problem did it solve?]

**Changes:**
- [Specific technical change 1]
- [Specific technical change 2]
- [Rationale or consequence]
```

**Rules:**
- Include commit hashes for traceability
- Explain the "why" with Context sections
- Use technical terms accurately
- Include data model changes, API changes, architectural decisions
- Note breaking changes or migration requirements

**Example:**
```markdown
## **Clone Relationship Data Model** *(commits: 9482e4e, 6ff545e)*

Separated clone semantics from parent-child tree structure to support 
flexible agent collaboration patterns.

*Context:* Agents need to clone from any other agent in the tree, not 
just their immediate children. The existing `parent_id` field tracks 
organizational hierarchy (who created whom), but doesn't capture 
knowledge lineage (whose context was forked).

**Changes:**
- Added `cloned_from` column to agents table (nullable FK, ON DELETE SET NULL)
- Added `cloned_at` timestamp column (Unix milliseconds)
- Added index on `cloned_from` for query performance
- Distinction: `parent_id` = who created, `cloned_from` = whose context used
- AAPI clones: parent = calling agent, cloned_from = source agent
- Idempotent migration using `PRAGMA table_info()` checks
```

## Step 6: Organize and Present

**Final structure:**

```markdown
## Release Notes Analysis - <branch-name>

Based on analysis of X commits comprising Y insertions and Z deletions 
across W files:

---

## 1. Customer-Facing Release Notes
### "What's New" Section

[User-facing features grouped logically]

---

## 2. Technical Changes  
### For Engineering Context

[Technical changes with context, grouped logically]
```

## Common Patterns to Recognize

**Feature Development Arc:**
1. Database schema change
2. Backend API implementation  
3. Frontend UI components
4. Bug fixes and polish
5. Test coverage

→ **Group as ONE feature** in customer notes, show arc in technical notes

**Bug Fix vs Feature:**
- Fixes usually touch fewer files, have "Fix" in message
- Features usually span multiple layers (DB → API → UI)
- Show fixes under "Improvements" in customer notes

**Refactoring:**
- Often invisible to users
- Goes in technical section only
- Explain "why" - performance? maintainability? extensibility?

**Infrastructure/Tooling:**
- Test improvements, CI changes, dev workflow
- Technical section only unless it impacts developer UX

## Edge Cases

**New patterns added:**
- Mention in technical section with context about what problem it solves
- If user-facing (changes workflow), mention in customer section too

**Large test additions:**
- Note in technical section: "Comprehensive test coverage added"
- Shows quality/stability investment

**Package updates:**
- Technical section only unless it enables a user-facing feature
- Note if security-related or fixes known issues

## Quality Check

Before presenting:

- [ ] Did I examine actual commit content, not just messages?
- [ ] Are related commits grouped into coherent features?
- [ ] Does customer version focus on user benefits?
- [ ] Does technical version explain "why" with context?
- [ ] Are commit hashes included for traceability?
- [ ] Is the scope accurate (files changed, lines changed)?
- [ ] Did I identify the real user impact vs implementation details?

## Anti-Patterns to Avoid

❌ **Listing every commit:**
```
- Commit A: Added column
- Commit B: Fixed bug
- Commit C: Added UI
```

✅ **Group by user impact:**
```
**Clone Tracking** - Users can now see clone relationships
- Technical implementation across 3 commits (abc, def, ghi)
```

❌ **Technical jargon in customer notes:**
```
- Added discriminated union for timeline items
- Implemented on-demand lazy loading via REST API
```

✅ **User benefits:**
```
- Clone events appear inline with your messages
- Agent info loads instantly when you click timestamps
```

❌ **No context in technical notes:**
```
- Added cloned_from column
```

✅ **Context included:**
```
- Added cloned_from column
  *Context:* Needed to track knowledge lineage separately from tree hierarchy
```

## Final Notes

- **Be thorough** - Read commits carefully, don't skim
- **Delegate large diffs** - If a diff is too large to read, delegate to a child agent to ask what's in it. Reply with follow ups until you have the info you need.
- **Think like users** - What changed in their experience?
- **Think like engineers** - Why was this done? What's the architecture?
- **Group intelligently** - Find the narrative arc across commits
- **Ask clarifying questions** - If unsure about impact/context, ask before presenting
