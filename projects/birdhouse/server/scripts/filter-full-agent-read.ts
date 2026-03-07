#!/usr/bin/env bun
// ABOUTME: Filters raw OpenCode session messages into Birdhouse's compact full-read shape.
// ABOUTME: Reads a JSON message array from stdin and writes filtered JSON to stdout.

import { filterMessagesForView } from "../src/features/aapi/helpers/message-filter";
import type { Message } from "../src/lib/opencode-client";

async function readStdin(): Promise<string> {
  return await new Response(Bun.stdin.stream()).text();
}

const input = await readStdin();

if (!input.trim()) {
  console.error("Expected raw OpenCode messages on stdin.");
  process.exit(1);
}

let messages: Message[];

try {
  messages = JSON.parse(input) as Message[];
} catch (error) {
  console.error(`Failed to parse stdin JSON: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

console.log(JSON.stringify(filterMessagesForView(messages, "full"), null, 2));
