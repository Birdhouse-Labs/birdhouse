// ABOUTME: Covers modal stack parsing and serialization helpers
// ABOUTME: Covers modal stack helper behavior
// ABOUTME: Ensures modal stack URLs round-trip consistently

import { describe, expect, test } from "vitest";
import { parseModalStack, popModalStack, pushModalStack, replaceModalByType, serializeModalStack } from "./routing";

describe("parseModalStack", () => {
  test("returns empty array for undefined", () => {
    expect(parseModalStack(undefined)).toEqual([]);
  });

  test("returns empty array for empty string", () => {
    expect(parseModalStack("")).toEqual([]);
  });

  test("parses single modal entry", () => {
    expect(parseModalStack("workspace_config/ws_123")).toEqual([{ type: "workspace_config", id: "ws_123" }]);
  });

  test("parses multiple modal entries", () => {
    expect(parseModalStack("agent/agent_1,agent/agent_2")).toEqual([
      { type: "agent", id: "agent_1" },
      { type: "agent", id: "agent_2" },
    ]);
  });

  test("ignores invalid entries", () => {
    expect(parseModalStack("agent/agent_1,invalid,workspace_config/")).toEqual([{ type: "agent", id: "agent_1" }]);
  });

  test("decodes encoded modal ids for file viewer routes", () => {
    expect(parseModalStack("file-viewer/%2FUsers%2Ftest%2Fworkspace%2Cnotes.md%23L42")).toEqual([
      { type: "file-viewer", id: "/Users/test/workspace,notes.md#L42" },
    ]);
  });

  test("ignores entries with malformed URI encoding", () => {
    expect(parseModalStack("agent/agent_1,file-viewer/%E0%A4%A,agent/agent_2")).toEqual([
      { type: "agent", id: "agent_1" },
      { type: "agent", id: "agent_2" },
    ]);
  });
});

describe("serializeModalStack", () => {
  test("returns undefined for empty stack", () => {
    expect(serializeModalStack([])).toBeUndefined();
  });

  test("serializes single modal entry", () => {
    expect(serializeModalStack([{ type: "agent", id: "agent_1" }])).toBe("agent/agent_1");
  });

  test("serializes multiple modal entries", () => {
    expect(
      serializeModalStack([
        { type: "agent", id: "agent_1" },
        { type: "workspace_config", id: "ws_123" },
      ]),
    ).toBe("agent/agent_1,workspace_config/ws_123");
  });

  test("round-trips parse and serialize", () => {
    const value = "agent/agent_1,agent/agent_2";
    expect(serializeModalStack(parseModalStack(value))).toBe(value);
  });

  test("encodes file viewer modal ids so paths survive commas and fragments", () => {
    expect(serializeModalStack([{ type: "file-viewer", id: "/Users/test/workspace,notes.md#L42" }])).toBe(
      "file-viewer/%2FUsers%2Ftest%2Fworkspace%2Cnotes.md%23L42",
    );
  });
});

describe("pushModalStack", () => {
  test("adds a modal to the stack", () => {
    expect(pushModalStack([], { type: "agent", id: "agent_1" })).toEqual([{ type: "agent", id: "agent_1" }]);
  });

  test("appends to existing stack", () => {
    expect(pushModalStack([{ type: "agent", id: "agent_1" }], { type: "agent", id: "agent_2" })).toEqual([
      { type: "agent", id: "agent_1" },
      { type: "agent", id: "agent_2" },
    ]);
  });

  test("avoids pushing duplicate top modal", () => {
    expect(pushModalStack([{ type: "agent", id: "agent_1" }], { type: "agent", id: "agent_1" })).toEqual([
      { type: "agent", id: "agent_1" },
    ]);
  });
});

describe("popModalStack", () => {
  test("returns empty array for empty stack", () => {
    expect(popModalStack([])).toEqual([]);
  });

  test("removes the last modal", () => {
    expect(popModalStack([{ type: "agent", id: "agent_1" }])).toEqual([]);
  });

  test("keeps earlier entries intact", () => {
    expect(
      popModalStack([
        { type: "agent", id: "agent_1" },
        { type: "workspace_config", id: "ws_123" },
      ]),
    ).toEqual([{ type: "agent", id: "agent_1" }]);
  });
});

describe("replaceModalByType", () => {
  test("replaces entry of matching type with new id", () => {
    expect(replaceModalByType([{ type: "skill-library-v2", id: "main" }], "skill-library-v2", "skill-123")).toEqual([
      { type: "skill-library-v2", id: "skill-123" },
    ]);
  });

  test("leaves non-matching types untouched", () => {
    expect(
      replaceModalByType(
        [
          { type: "agent", id: "agent_1" },
          { type: "skill-library-v2", id: "main" },
        ],
        "skill-library-v2",
        "skill-123",
      ),
    ).toEqual([
      { type: "agent", id: "agent_1" },
      { type: "skill-library-v2", id: "skill-123" },
    ]);
  });

  test("returns same array reference when id is already correct", () => {
    const stack = [{ type: "skill-library-v2", id: "skill-123" }];
    expect(replaceModalByType(stack, "skill-library-v2", "skill-123")).toBe(stack);
  });

  test("returns same array reference when type is not in stack", () => {
    const stack = [{ type: "agent", id: "agent_1" }];
    expect(replaceModalByType(stack, "skill-library-v2", "skill-123")).toBe(stack);
  });
});
