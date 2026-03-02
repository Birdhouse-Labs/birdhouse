// ABOUTME: Markdown rendering demo for typography and line-height testing
// ABOUTME: Shows comprehensive markdown samples with dark/light theme support

import { type Component, createMemo } from "solid-js";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { uiSize } from "../theme";

const markdownSamples = {
  headings: `
# Heading 1 — The Main Title
## Heading 2 — Section Title
### Heading 3 — Subsection
#### Heading 4 — Minor Section
##### Heading 5 — Small Heading
###### Heading 6 — Smallest Heading
`,

  paragraphs: `
**Short paragraph:** The quick brown fox jumps over the lazy dog.

**Medium paragraph:** Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

**Long paragraph:** The field of artificial intelligence has seen remarkable growth over the past decade, transforming industries from healthcare to finance. Machine learning algorithms now power everything from recommendation systems to autonomous vehicles. As we continue to push the boundaries of what's possible, we must also consider the ethical implications of these powerful technologies. The balance between innovation and responsibility remains one of the most important challenges of our time. Researchers and practitioners alike are working to develop frameworks that ensure AI systems are fair, transparent, and beneficial to society as a whole.
`,

  orderedLists: `
1. First level item one
   1. Second level nested item
   2. Another second level item
      1. Third level deeply nested
      2. Another third level item
         1. Fourth level — very deep nesting
   3. Back to second level
2. First level item two
3. First level item three
   1. Single nested item
`,

  unorderedLists: `
- First item
  - Nested item under first
  - Another nested item
    - Deeply nested item
    - Another deep item
      - Even deeper nesting
  - Back to second level
- Second item
- Third item
  - Single nested
`,

  mixedLists: `
1. Ordered parent
   - Unordered child
   - Another unordered
     1. Ordered grandchild
     2. Another ordered
        - Mixed back to unordered
   - Back to unordered
2. Second ordered
   - Unordered nested
     1. Then ordered
`,

  tables: `
| Feature | Status | Priority | Owner | Start Date | End Date | Dependencies | Budget |
|:--------|:------:|:--------:|------:|:----------:|:--------:|:-------------|-------:|
| Authentication | Done | High | @alice | 2024-01-01 | 2024-01-15 | None | $5,000 |
| Dashboard | In Progress | Medium | @bob | 2024-01-10 | 2024-02-01 | Authentication | $8,000 |
| API Integration | Pending | High | @carol | 2024-02-01 | 2024-02-28 | Authentication | $12,000 |
| Documentation | Done | Low | @dave | 2024-01-15 | 2024-01-30 | All features | $3,000 |
| Testing | In Progress | High | @eve | 2024-01-20 | 2024-02-15 | Dashboard, API | $6,000 |

**Wide API reference table (test horizontal scroll on mobile):**

| Method | Endpoint | Description | Request Body | Response Code | Response Body | Authentication | Rate Limit |
|--------|----------|-------------|--------------|---------------|---------------|----------------|------------|
| \`GET\` | \`/api/users/:id\` | Retrieves a single user by ID | None | 200, 404 | User object with all fields | Required (Bearer token) | 100/hour |
| \`POST\` | \`/api/users\` | Creates a new user account | JSON with name, email, password | 201, 400 | Created user object | Optional | 10/hour |
| \`PUT\` | \`/api/users/:id\` | Updates entire user record | JSON with all user fields | 200, 404, 400 | Updated user object | Required (Bearer token) | 50/hour |
| \`PATCH\` | \`/api/users/:id\` | Partially updates user fields | JSON with fields to update | 200, 404, 400 | Updated user object | Required (Bearer token) | 50/hour |
| \`DELETE\` | \`/api/users/:id\` | Permanently deletes user | None | 204, 404 | Empty response body | Required (Bearer token) | 20/hour |
`,

  blockquotes: `
> Simple blockquote with a single line of text.

> Multi-line blockquote that spans
> multiple lines but is still
> considered a single quote block.

> **Nested blockquotes:**
>
> > This is a nested quote inside another quote.
> >
> > > And this is a third level of nesting.
> > > It can go quite deep!
> >
> > Back to second level.
>
> Back to first level.

> Blockquote with other elements:
>
> - List item one
> - List item two
>
> \`\`\`
> code block inside quote
> \`\`\`
`,

  codeBlocks: `
Here's an inline \`const x = 42\` code snippet.

**Testing long inline code that might overflow:**

This is a sentence with a very long inline code snippet: \`const veryLongFunctionNameThatGoesOnAndOnAndMightCauseHorizontalOverflowIssuesOnMobileDevicesWithNarrowViewportsLikeIPhones = (param1, param2, param3) => { return doSomethingComplicated(); }\` and it continues after the code.

**TypeScript example:**

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await fetch(\`/api/users/\${id}\`);
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
\`\`\`

**Python example:**

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence
\`\`\`

**Shell commands:**

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build && npm run preview
\`\`\`

**JSON configuration:**

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true
  }
}
\`\`\`
`,

  textStyles: `
This paragraph has **bold text**, *italic text*, and ***bold italic text*** combined.

You can also use __underscores for bold__ and _underscores for italic_.

Here's ~~strikethrough text~~ for deleted content.

Mixed styles: **bold with *nested italic* inside** and *italic with **nested bold** inside*.

Inline \`code\` mixed with **bold \`code\`** and *italic \`code\`*.
`,

  links: `
**Inline links:**
- [OpenAI](https://openai.com) — AI research company
- [GitHub](https://github.com "GitHub - Where code lives") — with title
- [Local link](#headings) — anchor to section

**Reference-style links:**

Here's [a reference link][ref1] and [another one][ref2].

[ref1]: https://example.com "Example Domain"
[ref2]: https://example.org

**Auto-linked URLs:**
- https://example.com
- user@example.com
`,

  horizontalRules: `
Content above the rule.

---

Content between rules using hyphens.

***

Content between rules using asterisks.

___

Content below using underscores.
`,

  images: `
**Image from external service (picsum.photos):**

![Random photo from picsum](https://picsum.photos/400/200 "Beautiful random image from Lorem Picsum")

**Local image embedded in project:**

![Local sample image](/sample-image.svg "Sample SVG image from project")

**Intentionally broken image (to test error handling):**

![This image will not load](https://this-domain-definitely-does-not-exist-12345.invalid/missing.jpg "Example of broken image")

**Linked image:**

[![Click me](https://picsum.photos/200/100)](https://picsum.photos "Clickable image link to Lorem Picsum")
`,

  taskLists: `
**Project checklist:**

- [x] Design mockups
- [x] Set up development environment
- [ ] Implement core features
  - [x] Authentication
  - [ ] Dashboard
  - [ ] Settings page
- [ ] Write documentation
- [ ] Deploy to production
`,
};

const MarkdownDemo: Component = () => {
  const sizeClasses = createMemo(() => {
    const size = uiSize();
    return {
      prose: size === "sm" ? "prose-sm" : size === "md" ? "prose-base" : "prose-lg",
      heading: size === "sm" ? "text-base" : size === "md" ? "text-lg" : "text-xl",
    };
  });

  const MarkdownSection: Component<{ title: string; content: string }> = (props) => (
    <div class="space-y-3">
      <h3
        classList={{
          [sizeClasses().heading]: true,
        }}
        class="font-semibold border-b pb-2 text-heading border-border-muted"
      >
        {props.title}
      </h3>
      <MarkdownRenderer content={props.content} />
    </div>
  );

  return (
    <div class="flex flex-col h-full">
      {/* Header - Messages style */}
      <div class="px-4 py-3 border-b bg-surface-raised border-border flex-shrink-0 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-heading">Markdown</h2>
        <p class="text-sm text-text-secondary hidden md:block">Typography and markdown rendering samples</p>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-8 space-y-8">
        <MarkdownSection title="Headings" content={markdownSamples.headings} />
        <MarkdownSection title="Paragraphs" content={markdownSamples.paragraphs} />
        <MarkdownSection title="Ordered Lists" content={markdownSamples.orderedLists} />
        <MarkdownSection title="Unordered Lists" content={markdownSamples.unorderedLists} />
        <MarkdownSection title="Mixed Lists" content={markdownSamples.mixedLists} />
        <MarkdownSection title="Tables" content={markdownSamples.tables} />
        <MarkdownSection title="Blockquotes" content={markdownSamples.blockquotes} />
        <MarkdownSection title="Code Blocks" content={markdownSamples.codeBlocks} />
        <MarkdownSection title="Text Styles" content={markdownSamples.textStyles} />
        <MarkdownSection title="Links" content={markdownSamples.links} />
        <MarkdownSection title="Horizontal Rules" content={markdownSamples.horizontalRules} />
        <MarkdownSection title="Images" content={markdownSamples.images} />
        <MarkdownSection title="Task Lists" content={markdownSamples.taskLists} />
      </div>
    </div>
  );
};

export default MarkdownDemo;
