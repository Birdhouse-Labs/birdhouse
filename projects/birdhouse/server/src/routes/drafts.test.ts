// ABOUTME: Tests for composer draft routes — GET, PUT, DELETE with validation and round-trips
// ABOUTME: Includes binary round-trip tests for image and PDF attachments to verify SQLite fidelity

import { describe, expect, test } from "bun:test";
import { initAgentsDB } from "../lib/agents-db";
import { createTestApp } from "../test-utils/workspace-context";
import { createDraftRoutes } from "./drafts";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a test app with draft routes mounted, backed by an in-memory DB.
 */
async function buildApp() {
  const agentsDb = await initAgentsDB(":memory:");
  const app = await createTestApp({ agentsDb });
  app.route("/drafts", createDraftRoutes());
  return { app, agentsDb };
}

/**
 * Generate a realistic base64-encoded fake PNG (~4 KB).
 * The bytes are crafted with a valid PNG signature and IHDR chunk so
 * any parser treating it as a PNG won't immediately reject it, but it
 * is otherwise a minimal fixture. Crucially it is large enough to prove
 * the round-trip doesn't truncate data.
 */
function makeFakePngBase64(): string {
  // PNG signature: 8 bytes
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  // IHDR chunk: length(4) + "IHDR"(4) + width(4) + height(4) + bitdepth(1) + colortype(1) + compression(1) + filter(1) + interlace(1) + CRC(4) = 25 bytes
  const ihdr = [
    0x00,
    0x00,
    0x00,
    0x0d, // chunk length: 13
    0x49,
    0x48,
    0x44,
    0x52, // "IHDR"
    0x00,
    0x00,
    0x00,
    0x01, // width: 1
    0x00,
    0x00,
    0x00,
    0x01, // height: 1
    0x08,
    0x02, // bit depth: 8, color type: 2 (RGB)
    0x00,
    0x00,
    0x00, // compression, filter, interlace: 0
    0x90,
    0x77,
    0x53,
    0xde, // CRC (precomputed for this IHDR)
  ];
  // Pad to ~4 KB with deterministic repeating bytes so we can verify
  const paddingSize = 4096 - signature.length - ihdr.length;
  const padding: number[] = [];
  for (let i = 0; i < paddingSize; i++) {
    padding.push(i % 256);
  }

  const bytes = new Uint8Array([...signature, ...ihdr, ...padding]);
  // Convert to base64 via Buffer (available in Bun)
  return Buffer.from(bytes).toString("base64");
}

/**
 * Generate a realistic base64-encoded fake PDF (~3 KB).
 * Starts with the PDF signature %PDF-1.4 and is padded to ~3 KB.
 */
function makeFakePdfBase64(): string {
  const header = "%PDF-1.4\n";
  // Pad to ~3 KB
  const padLine = "% This is padding to make the fixture realistically sized.\n";
  let content = header;
  while (content.length < 3 * 1024) {
    content += padLine;
  }
  return Buffer.from(content, "utf8").toString("base64");
}

const FAKE_PNG_BASE64 = makeFakePngBase64();
const FAKE_PDF_BASE64 = makeFakePdfBase64();

// ============================================================================
// AgentsDB draft methods — unit tests
// ============================================================================

describe("AgentsDB draft methods", () => {
  test("getDraft returns empty draft for unknown draftId", async () => {
    const { agentsDb } = await buildApp();
    const draft = agentsDb.getDraft("new-agent");
    expect(draft).toEqual({ text: "", attachments: [] });
  });

  test("upsertDraft then getDraft returns stored text", async () => {
    const { agentsDb } = await buildApp();
    agentsDb.upsertDraft("new-agent", "new-agent", { text: "hello world", attachments: [] });
    const draft = agentsDb.getDraft("new-agent");
    expect(draft.text).toBe("hello world");
    expect(draft.attachments).toEqual([]);
  });

  test("upsertDraft replaces previous draft content atomically", async () => {
    const { agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_123", "reply", { text: "first draft", attachments: [] });
    agentsDb.upsertDraft("agent_123", "reply", { text: "second draft", attachments: [] });
    const draft = agentsDb.getDraft("agent_123");
    expect(draft.text).toBe("second draft");
  });

  test("upsertDraft replaces all attachments when re-upserted", async () => {
    const { agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_abc", "reply", {
      text: "v1",
      attachments: [{ filename: "old.png", mime: "image/png", url: "data:old" }],
    });
    agentsDb.upsertDraft("agent_abc", "reply", {
      text: "v2",
      attachments: [{ filename: "new.jpg", mime: "image/jpeg", url: "data:new" }],
    });
    const draft = agentsDb.getDraft("agent_abc");
    expect(draft.text).toBe("v2");
    expect(draft.attachments).toHaveLength(1);
    expect(draft.attachments[0].filename).toBe("new.jpg");
  });

  test("attachments are returned in insertion order (position)", async () => {
    const { agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_order", "reply", {
      text: "",
      attachments: [
        { filename: "first.png", mime: "image/png", url: "data:first" },
        { filename: "second.png", mime: "image/png", url: "data:second" },
        { filename: "third.pdf", mime: "application/pdf", url: "data:third" },
      ],
    });
    const draft = agentsDb.getDraft("agent_order");
    expect(draft.attachments.map((a) => a.filename)).toEqual(["first.png", "second.png", "third.pdf"]);
  });

  test("deleteDraft removes text and all attachments", async () => {
    const { agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_del", "reply", {
      text: "to delete",
      attachments: [{ filename: "img.png", mime: "image/png", url: "data:img" }],
    });
    agentsDb.deleteDraft("agent_del");
    const draft = agentsDb.getDraft("agent_del");
    expect(draft).toEqual({ text: "", attachments: [] });
  });

  test("deleteDraft is idempotent — no error for unknown draftId", async () => {
    const { agentsDb } = await buildApp();
    expect(() => agentsDb.deleteDraft("does-not-exist")).not.toThrow();
  });

  // ============================================================================
  // Binary round-trip tests (non-negotiable)
  // ============================================================================

  test("PNG image attachment survives round-trip through SQLite byte-for-byte", async () => {
    const { agentsDb } = await buildApp();

    agentsDb.upsertDraft("agent_png", "reply", {
      text: "draft with image",
      attachments: [
        {
          filename: "screenshot.png",
          mime: "image/png",
          url: `data:image/png;base64,${FAKE_PNG_BASE64}`,
        },
      ],
    });

    const draft = agentsDb.getDraft("agent_png");
    expect(draft.attachments).toHaveLength(1);
    expect(draft.attachments[0].filename).toBe("screenshot.png");
    expect(draft.attachments[0].mime).toBe("image/png");
    // Strict byte-for-byte identity
    expect(draft.attachments[0].url).toBe(`data:image/png;base64,${FAKE_PNG_BASE64}`);
  });

  test("PDF attachment survives round-trip through SQLite byte-for-byte", async () => {
    const { agentsDb } = await buildApp();

    agentsDb.upsertDraft("agent_pdf", "reply", {
      text: "draft with pdf",
      attachments: [
        {
          filename: "document.pdf",
          mime: "application/pdf",
          url: `data:application/pdf;base64,${FAKE_PDF_BASE64}`,
        },
      ],
    });

    const draft = agentsDb.getDraft("agent_pdf");
    expect(draft.attachments).toHaveLength(1);
    expect(draft.attachments[0].filename).toBe("document.pdf");
    expect(draft.attachments[0].mime).toBe("application/pdf");
    // Strict byte-for-byte identity
    expect(draft.attachments[0].url).toBe(`data:application/pdf;base64,${FAKE_PDF_BASE64}`);
  });

  test("multiple attachments of mixed types all survive round-trip", async () => {
    const { agentsDb } = await buildApp();

    agentsDb.upsertDraft("agent_mixed", "reply", {
      text: "multiple attachments",
      attachments: [
        { filename: "image.png", mime: "image/png", url: `data:image/png;base64,${FAKE_PNG_BASE64}` },
        { filename: "doc.pdf", mime: "application/pdf", url: `data:application/pdf;base64,${FAKE_PDF_BASE64}` },
      ],
    });

    const draft = agentsDb.getDraft("agent_mixed");
    expect(draft.attachments).toHaveLength(2);
    expect(draft.attachments[0].url).toBe(`data:image/png;base64,${FAKE_PNG_BASE64}`);
    expect(draft.attachments[1].url).toBe(`data:application/pdf;base64,${FAKE_PDF_BASE64}`);
  });
});

// ============================================================================
// Route tests — GET
// ============================================================================

describe("GET /drafts/:draftId", () => {
  test("returns 200 with empty draft for unknown draftId", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/new-agent");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ text: "", attachments: [] });
  });

  test("returns stored draft text and attachments", async () => {
    const { app, agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_get", "reply", {
      text: "stored text",
      attachments: [{ filename: "f.png", mime: "image/png", url: "data:..." }],
    });

    const res = await app.request("/drafts/agent_get");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { text: string; attachments: { filename: string }[] };
    expect(body.text).toBe("stored text");
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].filename).toBe("f.png");
  });
});

// ============================================================================
// Route tests — PUT
// ============================================================================

describe("PUT /drafts/:draftId", () => {
  test("stores draft and returns { ok: true }", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/new-agent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "new-agent", text: "hello", attachments: [] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("stored draft is retrievable via GET", async () => {
    const { app } = await buildApp();
    await app.request("/drafts/agent_put", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "my draft",
        attachments: [{ filename: "img.png", mime: "image/png", url: "data:img" }],
      }),
    });
    const res = await app.request("/drafts/agent_put");
    const body = (await res.json()) as { text: string; attachments: { filename: string }[] };
    expect(body.text).toBe("my draft");
    expect(body.attachments[0].filename).toBe("img.png");
  });

  test("returns 400 when context is missing", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hi", attachments: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when text is not a string", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "reply", text: 42, attachments: [] }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when attachments is not an array", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: "reply", text: "hi", attachments: "bad" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when an attachment is missing filename", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "hi",
        attachments: [{ mime: "image/png", url: "data:x" }],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when an attachment is missing mime", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "hi",
        attachments: [{ filename: "f.png", url: "data:x" }],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 when an attachment is missing url", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "hi",
        attachments: [{ filename: "f.png", mime: "image/png" }],
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 413 when payload exceeds 20 MB", async () => {
    const { app } = await buildApp();
    // Create a url string just over the 20 MB limit
    const oversizedUrl = "x".repeat(20 * 1024 * 1024 + 1);
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "",
        attachments: [{ filename: "big.bin", mime: "application/octet-stream", url: oversizedUrl }],
      }),
    });
    expect(res.status).toBe(413);
  });

  test("accepts payload at exactly 20 MB", async () => {
    const { app } = await buildApp();
    const exactUrl = "x".repeat(20 * 1024 * 1024);
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: "reply",
        text: "",
        attachments: [{ filename: "exact.bin", mime: "application/octet-stream", url: exactUrl }],
      }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid JSON body", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Route tests — DELETE
// ============================================================================

describe("DELETE /drafts/:draftId", () => {
  test("returns 200 and { ok: true } when draft exists", async () => {
    const { app, agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_todel", "reply", { text: "bye", attachments: [] });

    const res = await app.request("/drafts/agent_todel", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("returns 200 and { ok: true } even when draft does not exist (idempotent)", async () => {
    const { app } = await buildApp();
    const res = await app.request("/drafts/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("draft is gone after DELETE", async () => {
    const { app, agentsDb } = await buildApp();
    agentsDb.upsertDraft("agent_gone", "reply", {
      text: "gone",
      attachments: [{ filename: "f.png", mime: "image/png", url: "data:x" }],
    });

    await app.request("/drafts/agent_gone", { method: "DELETE" });

    const res = await app.request("/drafts/agent_gone");
    const body = await res.json();
    expect(body).toEqual({ text: "", attachments: [] });
  });
});
