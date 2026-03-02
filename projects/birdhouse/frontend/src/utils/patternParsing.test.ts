// ABOUTME: Test suite for pattern XML parsing utilities
// ABOUTME: Validates extraction and stripping of pattern XML blocks from messages

import { describe, expect, it } from "vitest";
import { extractPatternsFromXML, stripPatternXML } from "./patternParsing";

describe("extractPatternsFromXML", () => {
  describe("Basic Extraction", () => {
    it("should extract single pattern ID", () => {
      const input = `
User message here

<birdhouse-pattern id="pattern_abc123">
Content here
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_abc123"]);
    });

    it("should extract multiple pattern IDs", () => {
      const input = `
User message here

<birdhouse-pattern id="pattern_abc123">
Content for ABC
</birdhouse-pattern>

<birdhouse-pattern id="pattern_xyz789">
Content for XYZ
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result.sort()).toEqual(["pattern_abc123", "pattern_xyz789"]);
    });

    it("should handle pattern IDs with underscores", () => {
      const input = `<birdhouse-pattern id="pattern_debug_001">Content</birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_debug_001"]);
    });

    it("should handle pattern IDs with hyphens", () => {
      const input = `<birdhouse-pattern id="pattern-debug-001">Content</birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern-debug-001"]);
    });

    it("should deduplicate duplicate pattern IDs", () => {
      const input = `
<birdhouse-pattern id="pattern_abc123">Content 1</birdhouse-pattern>
<birdhouse-pattern id="pattern_abc123">Content 2</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_abc123"]);
    });

    it("should distinguish similar pattern IDs", () => {
      const input = `
<birdhouse-pattern id="pattern_debug001">Content 1</birdhouse-pattern>
<birdhouse-pattern id="pattern_debug002">Content 2</birdhouse-pattern>
<birdhouse-pattern id="pattern_debug010">Content 3</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result.sort()).toEqual(["pattern_debug001", "pattern_debug002", "pattern_debug010"]);
    });
  });

  describe("Content Handling", () => {
    it("should handle multi-line content", () => {
      const input = `
<birdhouse-pattern id="pattern_test">
Line 1
Line 2
Line 3
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });

    it("should handle content with special characters", () => {
      const input = `
<birdhouse-pattern id="pattern_test">
Content with !@#$%^&*()
And symbols: {}[]|\\:;"'<>,.?/
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });

    it("should handle content with < and > characters", () => {
      const input = `
<birdhouse-pattern id="pattern_test">
if (x > 5 && y < 10) {
  return x + y;
}
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });

    it('should not confuse "birdhouse-pattern" in content with tags', () => {
      const input = `
<birdhouse-pattern id="pattern_test">
This content mentions birdhouse-pattern as text
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });

    it("should handle empty content", () => {
      const input = `<birdhouse-pattern id="pattern_test"></birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });

    it("should handle content with newlines at boundaries", () => {
      const input = `<birdhouse-pattern id="pattern_test">

Content with leading/trailing newlines

</birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });
  });

  describe("Edge Cases - Malformed Tags", () => {
    it("should ignore unclosed tags", () => {
      const input = `
<birdhouse-pattern id="pattern_test">
Content without closing tag
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual([]);
    });

    it("should ignore mismatched tags", () => {
      const input = `
<birdhouse-pattern id="pattern_abc">
Content
</some-other-tag>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual([]);
    });

    it("should ignore opening tag only", () => {
      const input = `<birdhouse-pattern id="pattern_test">`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual([]);
    });

    it("should ignore closing tag only", () => {
      const input = `</birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual([]);
    });
  });

  describe("Attribute Handling", () => {
    it("should handle attributes in any order", () => {
      // ID first
      const input1 = `<birdhouse-pattern id="pattern_test" title="Test Pattern">Content</birdhouse-pattern>`;
      const result1 = extractPatternsFromXML(input1);
      expect(result1).toEqual(["pattern_test"]);

      // ID after other attributes
      const input2 = `<birdhouse-pattern title="Test Pattern" id="pattern_test">Content</birdhouse-pattern>`;
      const result2 = extractPatternsFromXML(input2);
      expect(result2).toEqual(["pattern_test"]);
    });

    it("should handle both single and double quotes", () => {
      // Double quotes
      const input1 = `<birdhouse-pattern id="pattern_test">Content</birdhouse-pattern>`;
      const result1 = extractPatternsFromXML(input1);
      expect(result1).toEqual(["pattern_test"]);

      // Single quotes
      const input2 = `<birdhouse-pattern id='pattern_test'>Content</birdhouse-pattern>`;
      const result2 = extractPatternsFromXML(input2);
      expect(result2).toEqual(["pattern_test"]);
    });

    it("should ignore extra attributes gracefully", () => {
      const input = `<birdhouse-pattern id="pattern_test" title="Test" category="debug" version="1.0">Content</birdhouse-pattern>`;

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_test"]);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle complete user message with patterns", () => {
      const input = `
Please use [systematic debugging](birdhouse.pattern.pattern_debug001) and [TDD workflow](birdhouse.pattern.pattern_tdd002) to fix this bug.

Here's the error:
\`\`\`
TypeError: Cannot read property 'x' of undefined
\`\`\`

<birdhouse-pattern id="pattern_debug001">
## Systematic Debugging Process

YOU MUST ALWAYS find the root cause of any issue you are debugging.

### Phase 1: Root Cause Investigation
- Read Error Messages Carefully
- Reproduce Consistently
</birdhouse-pattern>

<birdhouse-pattern id="pattern_tdd002">
## Test Driven Development

FOR EVERY NEW FEATURE OR BUGFIX:
1. Write a failing test
2. Run the test to confirm it fails
3. Write ONLY enough code to make it pass
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result.sort()).toEqual(["pattern_debug001", "pattern_tdd002"]);
    });

    it("should handle pattern with code blocks", () => {
      const input = `
Message here

<birdhouse-pattern id="pattern_example">
Example code:
\`\`\`typescript
function test() {
  return true;
}
\`\`\`
</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result).toEqual(["pattern_example"]);
    });
  });

  describe("Regex Behavior", () => {
    it("should use non-greedy matching", () => {
      const input = `
<birdhouse-pattern id="pattern_a">Content A</birdhouse-pattern>
<birdhouse-pattern id="pattern_b">Content B</birdhouse-pattern>
      `.trim();

      const result = extractPatternsFromXML(input);
      expect(result.sort()).toEqual(["pattern_a", "pattern_b"]);
    });

    it("should work on multiple calls (global flag resets)", () => {
      const input = `
<birdhouse-pattern id="pattern_a">A</birdhouse-pattern>
<birdhouse-pattern id="pattern_b">B</birdhouse-pattern>
      `.trim();

      const result1 = extractPatternsFromXML(input);
      const result2 = extractPatternsFromXML(input);
      const result3 = extractPatternsFromXML(input);

      expect(result1.sort()).toEqual(["pattern_a", "pattern_b"]);
      expect(result2.sort()).toEqual(["pattern_a", "pattern_b"]);
      expect(result3.sort()).toEqual(["pattern_a", "pattern_b"]);
    });
  });
});

describe("stripPatternXML", () => {
  describe("Basic Stripping", () => {
    it("should strip single pattern from message", () => {
      const input = `
User message here

<birdhouse-pattern id="pattern_abc123">
Pattern content to remove
</birdhouse-pattern>
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("User message here");
    });

    it("should strip multiple patterns from message", () => {
      const input = `
User message here

<birdhouse-pattern id="pattern_abc123">
Content 1
</birdhouse-pattern>

<birdhouse-pattern id="pattern_xyz789">
Content 2
</birdhouse-pattern>
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("User message here");
    });

    it("should preserve markdown links while stripping XML", () => {
      const input = `
Use [systematic debugging](birdhouse.pattern.pattern_debug001)

<birdhouse-pattern id="pattern_debug001">
Pattern prompt content
</birdhouse-pattern>
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("Use [systematic debugging](birdhouse.pattern.pattern_debug001)");
    });

    it("should preserve other content while stripping patterns", () => {
      const input = `
First paragraph

<birdhouse-pattern id="pattern_test">
Pattern content
</birdhouse-pattern>

Second paragraph

<birdhouse-pattern id="pattern_test2">
More pattern content
</birdhouse-pattern>

Third paragraph
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("First paragraph\n\n\n\nSecond paragraph\n\n\n\nThird paragraph");
    });

    it("should strip pattern with special characters in content", () => {
      const input = `
Message

<birdhouse-pattern id="pattern_test">
if (x < 5 && y > 10) { return true; }
</birdhouse-pattern>
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("Message");
    });
  });

  describe("Edge Cases", () => {
    it("should handle message with no patterns", () => {
      const input = "Just a regular message with no patterns";

      const result = stripPatternXML(input);
      expect(result).toBe(input);
    });

    it("should handle empty message", () => {
      const input = "";

      const result = stripPatternXML(input);
      expect(result).toBe("");
    });
  });

  describe("Real-World Scenarios", () => {
    it("should strip XML but preserve message and markdown links", () => {
      const input = `
Please use [systematic debugging](birdhouse.pattern.pattern_debug001) and [TDD workflow](birdhouse.pattern.pattern_tdd002) to fix this bug.

Here's the error:
\`\`\`
TypeError: Cannot read property 'x' of undefined
\`\`\`

<birdhouse-pattern id="pattern_debug001">
## Systematic Debugging Process
</birdhouse-pattern>

<birdhouse-pattern id="pattern_tdd002">
## Test Driven Development
</birdhouse-pattern>
      `.trim();

      const expected = `
Please use [systematic debugging](birdhouse.pattern.pattern_debug001) and [TDD workflow](birdhouse.pattern.pattern_tdd002) to fix this bug.

Here's the error:
\`\`\`
TypeError: Cannot read property 'x' of undefined
\`\`\`
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe(expected);
    });

    it("should strip pattern with code blocks", () => {
      const input = `
Message here

<birdhouse-pattern id="pattern_example">
Example code:
\`\`\`typescript
function test() {
  return true;
}
\`\`\`
</birdhouse-pattern>
      `.trim();

      const result = stripPatternXML(input);
      expect(result).toBe("Message here");
    });
  });
});
