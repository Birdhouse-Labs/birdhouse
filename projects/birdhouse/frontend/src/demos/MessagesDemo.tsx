// ABOUTME: Chat message bubbles demo with LLM-style conversation
// ABOUTME: Shows markdown rendering inside message bubbles with dark/light theme support

import type { AssistantMessage, UserMessage } from "@opencode-ai/sdk";
import { useSearchParams } from "@solidjs/router";
import { type Component, createSignal, Show } from "solid-js";
import ChatContainer from "../components/ui/ChatContainer";
import type { FileBlock, Message, ReasoningBlock, ToolBlock } from "../types/messages";

/**
 * Helper to create a mock OpenCode message info for demo purposes
 */
function createMockMessage(id: string, role: "user" | "assistant"): UserMessage | AssistantMessage {
  if (role === "user") {
    return {
      id,
      sessionID: "ses_demo",
      role: "user",
      time: { created: Date.now() },
    } as UserMessage;
  }
  return {
    id,
    sessionID: "ses_demo",
    role: "assistant",
    time: { created: Date.now() },
    parentID: "msg_user",
    modelID: "claude-sonnet-4",
    providerID: "anthropic",
    mode: "build",
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    path: { cwd: "/", root: "/" },
  } as AssistantMessage;
}

const sampleConversation: Message[] = [
  // Sample: Text with tool call (completed)
  {
    id: "demo-1",
    role: "user",
    content: "Can you check the package.json and tell me what version of SolidJS we're using?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-1", "user"),
  },
  {
    id: "demo-2",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll read the package.json file to check the SolidJS version.",
    opencodeMessage: createMockMessage("demo-2", "assistant"),
    blocks: [
      {
        id: "tool-1",
        type: "tool",
        callID: "call-1",
        name: "read",
        status: "completed",
        title: "Read package.json",
        input: {
          filePath: "/path/to/my-project/package.json",
        },
        output: `{
  "name": "vite-template-solid",
  "version": "0.0.0",
  "description": "",
  "scripts": {
    "start": "vite",
    "dev": "vite",
    "build": "vite build",
    "serve": "vite preview"
  },
  "dependencies": {
    "solid-js": "^1.9.9"
  },
  "devDependencies": {
    "vite": "^7.3.0",
    "vite-plugin-solid": "^2.10.2"
  }
}`,
        metadata: { description: "Read package.json" },
      } as ToolBlock,
      {
        id: "text-1",
        type: "text",
        content:
          "Looking at the package.json, you're using **SolidJS version 1.9.9**. That's a recent stable release with great performance!",
      },
    ],
    timestamp: new Date(),
  },

  // Sample: Bash tool with long multi-line output (tests "last 10 lines" display)
  {
    id: "demo-3",
    role: "user",
    content: "Run the build and show me the output",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-3", "user"),
  },
  {
    id: "demo-4",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll run the build command for you.",
    opencodeMessage: createMockMessage("demo-4", "assistant"),
    blocks: [
      {
        id: "tool-2",
        type: "tool",
        callID: "call-2",
        name: "bash",
        status: "completed",
        title: "Build the frontend",
        input: {
          command: "pnpm run build",
          description: "Build the frontend",
          workdir: "/path/to/my-project",
        },
        output: `> vite-template-solid@0.0.0 build /path/to/my-project
> vite build

vite v7.3.0 building client environment for production...
✓ 15 modules transformed.
transforming (1) index.html
transforming (250) node_modules/solid-js/dist/solid.js
transforming (500) node_modules/corvu/dist/primitives/dialog/index.js
transforming (1000) src/components/ui/Button.tsx
transforming (1500) src/demos/CodeBlockDemo/samples/python.ts
transforming (2000) node_modules/marked/lib/marked.esm.js
transforming (2441) src/App.tsx
✓ 2441 modules transformed.
rendering chunks...
computing gzip size (1/85) dist/assets/index-abc123.css
computing gzip size (42/85) dist/assets/python-def456.js
computing gzip size (85/85) dist/assets/index-xyz789.js
dist/index.html                                       0.96 kB │ gzip:   0.52 kB
dist/assets/index-DaHciMU1.css                       98.50 kB │ gzip:  14.07 kB
dist/assets/codeowners-Bp6g37R7.js                    0.55 kB │ gzip:   0.32 kB
dist/assets/shellsession-BADoaaVG.js                  0.71 kB │ gzip:   0.43 kB
dist/assets/tsv-B_m7g4N7.js                           0.74 kB │ gzip:   0.34 kB
dist/assets/javascript-wDzz0qaB.js                  174.83 kB │ gzip:  16.60 kB
dist/assets/typescript-BPQ3VLAy.js                  181.08 kB │ gzip:  16.11 kB
dist/assets/index-XyZ123.js                         423.12 kB │ gzip:  95.34 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 4.63s`,
        metadata: {
          description: "Build the frontend",
          exitCode: 0,
          duration: 4630,
        },
      } as ToolBlock,
      {
        id: "text-2",
        type: "text",
        content: "Build completed successfully! The frontend compiled **2,441 modules** in 4.6 seconds.",
      },
    ],
    timestamp: new Date(),
  },

  // Sample: Edit tool with diff metadata
  {
    id: "demo-5",
    role: "user",
    content: "Can you add a comment to the ChatContainer component?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-5", "user"),
  },
  {
    id: "demo-6",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll add a helpful comment to the ChatContainer component.",
    opencodeMessage: createMockMessage("demo-6", "assistant"),
    blocks: [
      {
        id: "tool-3",
        type: "tool",
        callID: "call-3",
        name: "edit",
        status: "completed",
        title: "Add comment to ChatContainer.tsx",
        input: {
          filePath: "src/components/ui/ChatContainer.tsx",
          oldString: "export const ChatContainer: Component<ChatContainerProps> = (props) => {",
          newString:
            "// Main chat container with newest-at-top message ordering\nexport const ChatContainer: Component<ChatContainerProps> = (props) => {",
        },
        output: "Edit applied successfully",
        metadata: {
          description: "Add comment to ChatContainer.tsx",
          diff: `--- src/components/ui/ChatContainer.tsx
+++ src/components/ui/ChatContainer.tsx
@@ -12,6 +12,7 @@
   children: JSX.Element;
 }
 
+// Main chat container with newest-at-top message ordering
 export const ChatContainer: Component<ChatContainerProps> = (props) => {
   return (
     <div class="flex flex-col h-full">`,
        },
      } as ToolBlock,
      {
        id: "text-3",
        type: "text",
        content: "Comment added! The ChatContainer now has a clear description of its purpose.",
      },
    ],
    timestamp: new Date(),
  },

  // Sample: Failed tool call
  {
    id: "demo-7",
    role: "user",
    content: "Can you read /etc/shadow?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-7", "user"),
  },
  {
    id: "demo-8",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll attempt to read that file.",
    opencodeMessage: createMockMessage("demo-8", "assistant"),
    blocks: [
      {
        id: "tool-4",
        type: "tool",
        callID: "call-4",
        name: "read",
        status: "error",
        title: "Read /etc/shadow",
        input: { filePath: "/etc/shadow" },
        error: "EACCES: permission denied, open '/etc/shadow'",
        metadata: {
          description: "Read /etc/shadow",
          exitCode: 1,
        },
      } as ToolBlock,
      {
        id: "text-4",
        type: "text",
        content:
          "I don't have permission to read that file. The `/etc/shadow` file contains sensitive password hashes and requires root access.",
      },
    ],
    timestamp: new Date(),
  },

  // Sample: Reasoning block
  {
    id: "demo-5",
    role: "user",
    content: "What's the best way to optimize this React component?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-5", "user"),
  },
  {
    id: "demo-6",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "Let me analyze the component and suggest optimizations.",
    opencodeMessage: createMockMessage("demo-6", "assistant"),
    blocks: [
      {
        id: "reasoning-1",
        type: "reasoning",
        content: `Let me think through this optimization problem systematically.

First, I need to understand the current rendering behavior:

1. **Re-render frequency** - Is it re-rendering unnecessarily on every parent update?
2. **Props stability** - Are new objects being created on each render, breaking referential equality?
3. **Child component memoization** - Are children optimized with memo() wrappers?
4. **Effect dependencies** - Are effects firing too often due to unstable dependencies?

Looking at the code structure, I can see several anti-patterns:

- Inline function creation in JSX (creates new functions every render)
- Object literals passed as props (new object every time)
- Missing memo() wrappers on pure components
- Effect dependencies that include non-memoized values

The root cause appears to be that the component creates new callback functions on every render. When these callbacks are passed to child components, React sees them as "new" props and triggers child re-renders, even though the actual behavior hasn't changed.

For SolidJS specifically, we need to be careful about:
- Creating signals/memos inside JSX (should be at component top level)
- Passing reactive expressions vs getter functions
- Using createMemo for derived values that are expensive to compute

The solution should involve stabilizing all callbacks and ensuring derived values are properly memoized.`,
        timestamp: new Date(),
      } as ReasoningBlock,
      {
        id: "text-2",
        type: "text",
        content: `Based on my analysis, here are the key optimizations:

1. **Memoize callbacks** with \`useCallback\` to prevent child re-renders
2. **Use \`memo()\` on child components** that receive complex props
3. **Split into smaller components** to isolate re-render scope

This should significantly improve performance!`,
      },
    ],
    timestamp: new Date(),
  },

  // Sample: File/image block
  {
    id: "demo-7",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "Here's a diagram showing the architecture:",
    blocks: [
      {
        id: "file-1",
        type: "file",
        mimeType: "image/png",
        url: "https://placehold.co/600x400/4a5568/ffffff?text=Architecture+Diagram",
        filename: "architecture.png",
      } as FileBlock,
    ],
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-7", "assistant"),
  },

  // Sample: Tool with long input AND long output (bash with heredoc)
  {
    id: "demo-long-both",
    opencodeMessage: createMockMessage("demo-long-both", "user"),
    role: "user",
    content: "Create a pull request for the authentication changes",
    timestamp: new Date(),
  },
  {
    id: "demo-long-both-response",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll create a pull request with a detailed description of the changes.",
    opencodeMessage: createMockMessage("demo-long-both-response", "assistant"),
    blocks: [
      {
        id: "tool-long-both",
        type: "tool",
        callID: "call-5",
        name: "bash",
        status: "completed",
        title: "Create pull request with detailed description",
        input: {
          command: `gh pr create --title "Add comprehensive authentication system" --body "$(cat <<'EOF'
## Summary

This PR implements a robust authentication system with comprehensive validation and error handling.

## Changes Made

### Core Authentication
- Implemented email/password validation
- Added password strength requirements (min 8 characters)
- Email format validation using RFC-compliant regex
- Structured error responses for better UX

### Security Improvements
- Credential handling with httpOnly cookies
- CSRF protection via credentials: 'include'
- Secure password transmission over HTTPS
- No sensitive data in client-side storage

### Error Handling
- Try-catch blocks around all network calls
- Graceful degradation on network failures
- User-friendly error messages
- Backend error parsing and propagation

### Developer Experience
- Full TypeScript type safety
- Return structured results instead of throwing
- Console logging for debugging
- Comprehensive inline documentation

## Testing
- Unit tests for all validation functions
- Integration tests for auth flow
- Error case coverage
- Manual testing on dev environment

## Performance Impact
- Minimal: validation is synchronous and fast
- Network calls properly await responses
- No blocking operations on main thread

EOF
)"`,
          description: "Create pull request with detailed description",
        },
        output: `remote: 
remote: Create a pull request for 'feature/auth-system' on GitHub by visiting:
remote:      https://github.com/example/repo/pull/new/feature/auth-system
remote: 
To github.com:example/repo.git
 * [new branch]      feature/auth-system -> feature/auth-system
Branch 'feature/auth-system' set up to track remote branch 'feature/auth-system' from 'origin'.

Creating pull request for feature/auth-system into main in example/repo

https://github.com/example/repo/pull/42

✓ Pull request created successfully
  Title: Add comprehensive authentication system
  URL: https://github.com/example/repo/pull/42
  Base: main
  Head: feature/auth-system
  Assignees: none
  Labels: none
  Reviewers: none

Pull request #42 opened and ready for review.`,
        metadata: {
          description: "Create pull request with detailed description",
          duration: 3420,
          exitCode: 0,
        },
      } as ToolBlock,
    ],
    timestamp: new Date(),
  },
  {
    id: "demo-long-both-response",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll refactor the authentication handler with better error handling and validation.",
    opencodeMessage: createMockMessage("demo-long-both-response", "assistant"),
    blocks: [
      {
        id: "tool-long-both",
        type: "tool",
        callID: "call-6",
        name: "edit",
        status: "completed",
        title: "Refactor authentication handler",
        input: {
          filePath: "src/auth/handler.ts",
          oldString: "export const handleAuth = () => {}",
          newString: `export const handleAuth = async (credentials: AuthCredentials): Promise<AuthResult> => {
  // Validate input parameters
  if (!credentials?.email || !credentials?.password) {
    return { success: false, error: 'Email and password are required' };
  }

  // Validate email format
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  if (!emailRegex.test(credentials.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Validate password strength
  if (credentials.password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters' };
  }

  try {
    // Authenticate with backend
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || 'Authentication failed' };
    }

    const data = await response.json();
    return { 
      success: true, 
      token: data.token,
      user: data.user 
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Network error - please try again' };
  }
}`,
        },
        output: `File: src/auth/handler.ts
Status: Modified
Lines changed: 43

Changes applied:
- Added comprehensive input validation
- Implemented password strength checking  
- Added email format validation
- Wrapped fetch in try-catch for network errors
- Return structured result object instead of throwing
- Added proper TypeScript return type annotation
- Included credentials: 'include' for cookie handling
- Parse error responses from backend
- Added detailed error messages for user feedback
- Console logging for debugging authentication failures

The authentication handler is now more robust and user-friendly with better error handling throughout.`,
        metadata: {
          description: "Refactor authentication handler",
          duration: 234,
        },
      } as ToolBlock,
    ],
    timestamp: new Date(),
  },

  // Sample: Error block
  {
    id: "demo-8",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll try to access that file.",
    opencodeMessage: createMockMessage("demo-8", "assistant"),
    blocks: [
      {
        id: "tool-3",
        type: "tool",
        callID: "call-7",
        name: "read",
        status: "error",
        title: "Read config.secret.json",
        input: { filePath: "/etc/secret/config.json" },
        error: "EACCES: permission denied, open '/etc/secret/config.json'",
        metadata: { exitCode: 1 },
      } as ToolBlock,
    ],
    error: {
      id: "error-1",
      type: "error",
      errorType: "unknown",
      message: "Failed to read file due to permission error",
    },
    timestamp: new Date(),
  },

  // Original conversation continues below...
  {
    id: "1",
    role: "user",
    content: `**Production is down!** Help!

We're getting **intermittent 500 errors** in production. The weird part:
- Only happens during peak hours
- Stack trace shows \`TypeError: Cannot read property 'id' of undefined\`
- **Can't reproduce locally**

Here's what I know:
- Started after yesterday's deploy
- Affects about **3-5% of requests**
- Error appears in our \`UserService.getProfile()\` method`,
    timestamp: new Date(),
    opencodeMessage: createMockMessage("1", "user"),
  },
  {
    id: "2",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: `> *It was a dark and stormy deploy. The kind that makes veteran engineers reach for the rollback button. But I don't rollback—I dig.*

Let me take a look at this case, pal. **3-5% failure rate during peak hours?** That's got race condition written all over it.

First, show me the crime scene. I need to see that stack trace:

\`\`\`bash
# Get me the full stack trace from your logs
grep "Cannot read property 'id'" /var/log/app.log | tail -20
\`\`\`

And while you're at it, show me that \`UserService.getProfile()\` method. Something tells me there's a missing \`await\` somewhere—they always forget the \`await\`. It's the semicolon of the async era.

**Working theory:** You've got an async operation that's returning a promise instead of the resolved value. Works fine on slow local databases, falls apart when production traffic piles up.

Let's crack this case. Share that code.`,
    opencodeMessage: createMockMessage("2", "assistant"),
    timestamp: new Date(),
  },
  {
    id: "3",
    role: "user",
    content: `Here's the method that's failing:

\`\`\`typescript
async getProfile(userId: string) {
  const user = this.cache.get(userId) || 
               await this.db.users.findById(userId);
  
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}
\`\`\`

The cache is a simple **in-memory Map**. Should be fine, right?`,
    timestamp: new Date(),
    opencodeMessage: createMockMessage("3", "user"),
  },
  {
    id: "4",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    opencodeMessage: createMockMessage("4", "assistant"),
    content: `> *Bingo. The perp was hiding in plain sight—masquerading as harmless caching code. But I've seen this pattern before. It never ends well.*

There's your problem, kid. Let me break down this crime:

## The Smoking Gun

\`\`\`typescript
const user = this.cache.get(userId) || await this.db.users.findById(userId);
\`\`\`

See that \`||\` operator? Here's what's happening:

| Scenario | cache.get() returns | Result |
|----------|-------------------|---------|
| **Cache hit** | \`Promise<User>\` | Uses the Promise object directly |
| **Cache miss** | \`undefined\` | Awaits DB call correctly |

**The twist:** When there's a cache hit, \`this.cache.get(userId)\` returns a **Promise**—but you're not awaiting it. The \`||\` operator sees a truthy Promise object and uses it directly. Then you try to access \`.id\` on a Promise instead of a User.

### Why it's intermittent:

- **First request** (cold cache): Cache miss → await fires → works fine
- **Peak hours** (warm cache): Cache hit → Promise not awaited → \`user.id\` is \`undefined\`
- **Local testing** (slow DB): Race condition doesn't manifest → seems fine

## The Fix

\`\`\`typescript
async getProfile(userId: string) {
  let user = this.cache.get(userId);
  
  if (!user) {
    user = await this.db.users.findById(userId);
    this.cache.set(userId, user);  // Fix: Store the resolved value
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}
\`\`\`

**But wait—** what *is* your cache storing? Show me the \`cache.set()\` call. I bet you're caching the Promise instead of the resolved User object.`,
    timestamp: new Date(),
  },
  {
    id: "5",
    role: "user",
    content: `Oh god, you're right:

\`\`\`typescript
this.cache.set(userId, this.db.users.findById(userId));
\`\`\`

I'm **storing the Promise**, not the user! No wonder it breaks.`,
    timestamp: new Date(),
    opencodeMessage: createMockMessage("5", "user"),
  },
  {
    id: "6",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: `> *Case closed. Another async/await gotcha put behind bars. The city could sleep safe tonight—at least until the next deploy.*

**There it is.** The missing \`await\` strikes again.

## The Complete Fix

\`\`\`typescript
async getProfile(userId: string): Promise<UserProfile> {
  let user = this.cache.get(userId);
  
  if (!user) {
    user = await this.db.users.findById(userId);  // Await the DB call
    this.cache.set(userId, user);                 // Cache the resolved value
  }
  
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}
\`\`\`

## Prevention: Make TypeScript Your Partner

Add these types to catch this at compile time:

\`\`\`typescript
class UserCache {
  private cache = new Map<string, User>();  // Not Promise<User>!
  
  get(userId: string): User | undefined {
    return this.cache.get(userId);
  }
  
  set(userId: string, user: User): void {  // Enforce User type
    this.cache.set(userId, user);
  }
}
\`\`\`

Now TypeScript will **scream** if you try to cache a Promise.

## The Lesson

1. **Never use \`||\` with mixed Promise/non-Promise values** 
2. **Type your caches explicitly** so you can't store the wrong thing
3. **Load test with warm caches** — that's where these bugs hide

Deploy that fix, and this particular nightmare is over. But stay sharp, friend. The city's full of bugs that only show up at 11:47 PM.

*Need anything else? I'll be here, waiting for the next case.*`,
    opencodeMessage: createMockMessage("6", "assistant"),
    timestamp: new Date(),
  },

  // Sample: Long output for scroll testing (100+ lines)
  {
    id: "demo-16",
    role: "user",
    content: "Can you run npm install and show me the full output?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-16", "user"),
  },
  {
    id: "demo-17",
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: "I'll run npm install for you.",
    opencodeMessage: createMockMessage("demo-17", "assistant"),
    blocks: [
      {
        id: "tool-long",
        type: "tool",
        callID: "call-8",
        name: "bash",
        status: "completed",
        title: "Install dependencies",
        input: {
          command: "npm install",
          description: "Install all npm dependencies",
          workdir: "/path/to/my-project",
        },
        output: `npm WARN deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value.
npm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported
npm WARN deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm WARN deprecated @humanwhocodes/config-array@0.11.14: Use @eslint/config-array instead
npm WARN deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
npm WARN deprecated eslint@8.57.0: Eslint 9 is now available. Upgrade when ready.

added 567 packages, and audited 568 packages in 12s

189 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities

> vite-template-solid@0.0.0 prepare
> husky install

husky - Git hooks installed

Installing dependencies...
  ✓ solid-js@1.9.9
  ✓ vite@5.4.11
  ✓ typescript@5.6.3
  ✓ @types/node@22.9.3
  ✓ postcss@8.4.49
  ✓ tailwindcss@3.4.15
  ✓ autoprefixer@10.4.20
  ✓ @solidjs/router@0.15.2
  ✓ corvu@0.6.3
  ✓ marked@15.0.6
  ✓ shiki@1.24.2
  ✓ lucide-solid@0.461.0
  ✓ @vitest/ui@2.1.8
  ✓ vitest@2.1.8
  ✓ @testing-library/jest-dom@6.6.3
  ✓ @solidjs/testing-library@0.8.10
  ✓ jsdom@25.0.1
  ✓ happy-dom@16.8.2

Downloading packages...
[1/567] ████░░░░░░░░░░░░░░░░ 5%
[50/567] ████████░░░░░░░░░░░░ 8%
[100/567] ███████████████░░░░░ 17%
[150/567] ████████████████████░ 26%
[200/567] ██████████████████████████░░░░░░ 35%
[250/567] ████████████████████████████████░ 44%
[300/567] ██████████████████████████████████████░ 52%
[350/567] ████████████████████████████████████████████ 61%
[400/567] ██████████████████████████████████████████████████ 70%
[450/567] ████████████████████████████████████████████████████████ 79%
[500/567] ██████████████████████████████████████████████████████████████ 88%
[550/567] ████████████████████████████████████████████████████████████████████ 96%
[567/567] ████████████████████████████████████████████████████████████████████ 100%

Linking dependencies...
[1/567] ░░░░░░░░░░░░░░░░░░░░ 0%
[50/567] ████████░░░░░░░░░░░░ 8%
[100/567] ███████████████░░░░░ 17%
[150/567] ████████████████████░ 26%
[200/567] ██████████████████████████░░░░░░ 35%
[250/567] ████████████████████████████████░ 44%
[300/567] ██████████████████████████████████████░ 52%
[350/567] ████████████████████████████████████████████ 61%
[400/567] ██████████████████████████████████████████████████ 70%
[450/567] ████████████████████████████████████████████████████████ 79%
[500/567] ██████████████████████████████████████████████████████████████ 88%
[550/567] ████████████████████████████████████████████████████████████████████ 96%
[567/567] ████████████████████████████████████████████████████████████████████ 100%

Building fresh packages...
success Saved lockfile.
✨  Done in 12.34s

Post-install scripts...
Running prepare script...
Setting up git hooks...
Generating TypeScript definitions...
Building native dependencies...

Dependencies installed successfully!
  Total packages: 567
  Time elapsed: 12.34s
  Disk space: 245 MB
  
Vulnerabilities:
  High: 0
  Moderate: 0  
  Low: 0
  
All dependencies are up to date and secure!

Next steps:
  - Run 'npm run dev' to start development server
  - Run 'npm run build' to create production build
  - Run 'npm test' to run test suite
  
Happy coding! 🚀`,
        metadata: {
          description: "Install all npm dependencies",
          exitCode: 0,
          duration: 12340,
        },
      } as ToolBlock,
      {
        id: "text-long",
        type: "text",
        content:
          "All dependencies installed successfully! **567 packages** were added in 12.3 seconds with no vulnerabilities.",
      },
    ],
    timestamp: new Date(),
  },

  // Sample: Message with API error (rate limit)
  {
    id: "demo-error-1",
    role: "user",
    content: "Can you analyze this large codebase for security issues?",
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-error-1", "user"),
  },
  {
    id: "demo-error-2",
    role: "assistant",
    model: "Claude Opus 4",
    provider: "anthropic",
    content: "",
    blocks: [],
    error: {
      id: "err-1",
      type: "error",
      errorType: "api",
      message: "Rate limit exceeded. Please try again in 60 seconds.",
      statusCode: 429,
      isRetryable: true,
    },
    timestamp: new Date(),
    opencodeMessage: createMockMessage("demo-error-2", "assistant"),
  },

  // EDGE CASE: Very long word without spaces (could cause horizontal scroll)
  {
    id: "demo-long-word",
    opencodeMessage: createMockMessage("demo-long-word", "user"),
    role: "user",
    content: "What is supercalifragilisticexpialidociousantidisestablishmentarianismfloccinaucinihilipilification?",
    timestamp: new Date(),
  },
  {
    id: "demo-long-word-response",
    opencodeMessage: createMockMessage("demo-long-word-response", "assistant"),
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content:
      "That's an extraordinarily long compound word! Let me break it down: supercalifragilisticexpialidociousantidisestablishmentarianismfloccinaucinihilipilification is actually a combination of several very long words.",
    blocks: [],
    timestamp: new Date(),
  },

  // EDGE CASE: Long URL without spaces
  {
    id: "demo-long-url",
    opencodeMessage: createMockMessage("demo-long-url", "user"),
    role: "user",
    content:
      "Check this URL: https://example.com/very/long/path/with/many/segments/that/could/potentially/cause/horizontal/scrolling/issues/in/the/message/container/especially/on/mobile/devices",
    timestamp: new Date(),
  },

  // EDGE CASE: Long code line in inline code
  {
    id: "demo-long-code",
    opencodeMessage: createMockMessage("demo-long-code", "assistant"),
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content:
      "Here's the function: `const veryLongFunctionNameThatCouldPotentiallyCauseHorizontalScrollingIssuesInTheMessageContainer = (parameterWithVeryLongName) => { return processDataWithAnotherLongFunctionName(parameterWithVeryLongName); }`",
    blocks: [],
    timestamp: new Date(),
  },

  // EDGE CASE: Table with wide columns
  {
    id: "demo-wide-table",
    opencodeMessage: createMockMessage("demo-wide-table", "assistant"),
    role: "assistant",
    model: "Claude Sonnet 4",
    provider: "anthropic",
    content: `Here's a comparison table:

| Very Long Column Header Name | Another Extremely Long Header | Yet Another Wide Column Header | Final Super Long Header Name |
|------------------------------|-------------------------------|--------------------------------|------------------------------|
| Short value | Another value | More data here | Last column |
| This is a very long cell value that might cause issues | Another long value in this cell | Even more extensive data in this column | Final column with lengthy content |`,
    blocks: [],
    timestamp: new Date(),
  },

  // EDGE CASE: Unbroken string of characters
  {
    id: "demo-unbroken",
    opencodeMessage: createMockMessage("demo-unbroken", "user"),
    role: "user",
    content:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    timestamp: new Date(),
  },
];

const MessagesDemo: Component = () => {
  // Get query params for error banner demo
  const [searchParams] = useSearchParams();

  // State management - messages start in reverse order (newest first)
  const [messages, setMessages] = createSignal<Message[]>([...sampleConversation].reverse());
  const [inputValue, setInputValue] = createSignal("");
  const [isStreaming, setIsStreaming] = createSignal(false);

  // Error banner state (controlled by query params)
  const errorParam = searchParams["error"];
  const [sendError, setSendError] = createSignal<string | null>(typeof errorParam === "string" ? errorParam : null);

  const handleSendMessage = () => {
    const content = inputValue().trim();
    if (!content || isStreaming()) return;

    // Add user message at index 0 (newest at top)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
      opencodeMessage: createMockMessage(Date.now().toString(), "user"),
    };

    setMessages((prev) => [userMessage, ...prev]);
    setInputValue("");

    // Simulate assistant streaming response
    simulateAssistantResponse();
  };

  const simulateAssistantResponse = () => {
    setIsStreaming(true);

    // Create assistant message at index 0
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      model: "Claude Sonnet 4",
      provider: "anthropic",
      content: "",
      timestamp: new Date(),
      opencodeMessage: createMockMessage((Date.now() + 1).toString(), "assistant"),
    };

    setMessages((prev) => [assistantMessage, ...prev]);

    // Simulate streaming tokens
    const responseText = `I understand you're asking about that. Let me help you with a detailed response.

This is a simulated streaming response that appears token by token, demonstrating how the newest-at-top architecture handles streaming content naturally.

Notice how:
- The input box stays at the top (always accessible)
- No scroll management needed
- New content just appears at the top
- No keyboard avoidance on mobile required

Pretty neat, right?`;

    let charIndex = 0;
    const streamInterval = setInterval(() => {
      if (charIndex < responseText.length) {
        setMessages((prev) => {
          const updated = [...prev];
          const firstMessage = updated[0];
          if (firstMessage) {
            updated[0] = {
              ...firstMessage,
              content: firstMessage.content + responseText[charIndex],
            };
          }
          return updated;
        });
        charIndex++;
      } else {
        clearInterval(streamInterval);
        setIsStreaming(false);
      }
    }, 20); // 20ms per character for smooth streaming
  };

  const handleStop = () => {
    setIsStreaming(false);
  };

  return (
    <div class="flex flex-col h-full bg-surface">
      {/* Error banner (same as LiveMessages) */}
      <Show when={sendError()}>
        <div class="bg-surface-raised border-b border-danger px-3 py-2 flex-shrink-0">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-danger text-sm flex-shrink-0">⚠</span>
              <p class="text-sm text-text-secondary truncate">{sendError()}</p>
            </div>
            <button
              type="button"
              onClick={() => setSendError(null)}
              class="text-text-muted hover:text-text-primary text-sm flex-shrink-0"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      </Show>

      <ChatContainer
        messages={messages()}
        agentId="demo-agent"
        inputValue={inputValue()}
        isStreaming={isStreaming()}
        onInputChange={setInputValue}
        onSend={handleSendMessage}
        onStop={handleStop}
        isSendDisabled={false}
      />
    </div>
  );
};

export default MessagesDemo;
