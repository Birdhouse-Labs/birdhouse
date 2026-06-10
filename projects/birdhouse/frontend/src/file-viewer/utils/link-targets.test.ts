// ABOUTME: Covers markdown local file link target parsing behavior.
// ABOUTME: Verifies invalid href encodings degrade safely instead of throwing.

import { describe, expect, test } from "vitest";
import { parseLocalFileLinkTarget } from "./link-targets";

describe("parseLocalFileLinkTarget", () => {
  test("returns null for plain hrefs with malformed URI encoding", () => {
    expect(parseLocalFileLinkTarget("docs/%E0%A4%A.md#L12")).toBeNull();
  });
});
