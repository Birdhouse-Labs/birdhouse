// ABOUTME: Composer draft routes — GET/PUT/DELETE for per-surface draft persistence
// ABOUTME: Drafts are stored in agents.db and can hold text plus binary attachments (images, PDFs)

import { Hono } from "hono";
import type { AttachmentPayload, DraftPayload } from "../lib/agents-db";

/** 20 MB limit: total of text.length + sum of attachment url lengths */
const MAX_PAYLOAD_BYTES = 20 * 1024 * 1024;

export function createDraftRoutes() {
  const app = new Hono();

  /**
   * GET /api/workspace/:workspaceId/drafts/:draftId
   * Always 200 — returns empty draft if nothing stored yet.
   */
  app.get("/:draftId", (c) => {
    const agentsDb = c.get("agentsDb");
    const { draftId } = c.req.param();
    const draft = agentsDb.getDraft(draftId);
    return c.json<DraftPayload>(draft);
  });

  /**
   * PUT /api/workspace/:workspaceId/drafts/:draftId
   * Upserts the draft. Body: { context, text, attachments }
   * Returns 400 on invalid body, 413 if payload exceeds 20 MB.
   */
  app.put("/:draftId", async (c) => {
    const agentsDb = c.get("agentsDb");
    const { draftId } = c.req.param();

    let body: { text?: unknown; attachments?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { text, attachments } = body;
    const context = draftId === "new-agent" ? "new-agent" : "reply";

    if (typeof text !== "string") {
      return c.json({ error: "text must be a string" }, 400);
    }
    if (!Array.isArray(attachments)) {
      return c.json({ error: "attachments must be an array" }, 400);
    }

    const validatedAttachments: AttachmentPayload[] = [];
    for (let i = 0; i < attachments.length; i++) {
      const a = attachments[i];
      if (typeof a !== "object" || a === null) {
        return c.json({ error: `attachments[${i}] must be an object` }, 400);
      }
      const { filename, mime, url } = a as Record<string, unknown>;
      if (typeof filename !== "string" || !filename.trim()) {
        return c.json({ error: `attachments[${i}].filename is required` }, 400);
      }
      if (typeof mime !== "string" || !mime.trim()) {
        return c.json({ error: `attachments[${i}].mime is required` }, 400);
      }
      if (typeof url !== "string" || !url.trim()) {
        return c.json({ error: `attachments[${i}].url is required` }, 400);
      }
      validatedAttachments.push({ filename, mime, url });
    }

    // Size cap: total character count of text + all attachment urls
    const totalSize = text.length + validatedAttachments.reduce((sum, a) => sum + a.url.length, 0);
    if (totalSize > MAX_PAYLOAD_BYTES) {
      return c.json({ error: "Payload exceeds 20 MB limit" }, 413);
    }

    agentsDb.upsertDraft(draftId, context, { text, attachments: validatedAttachments });
    return c.json({ ok: true });
  });

  /**
   * DELETE /api/workspace/:workspaceId/drafts/:draftId
   * Idempotent — returns 200 even if the draft did not exist.
   */
  app.delete("/:draftId", (c) => {
    const agentsDb = c.get("agentsDb");
    const { draftId } = c.req.param();
    agentsDb.deleteDraft(draftId);
    return c.json({ ok: true });
  });

  return app;
}
