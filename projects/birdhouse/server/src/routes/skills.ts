// ABOUTME: Workspace-scoped API routes for listing visible OpenCode skills and Birdhouse trigger phrases.
// ABOUTME: Normalizes OpenCode skill data into Birdhouse responses and stores trigger phrases by skill name.

import { Hono } from "hono";
import { getDepsFromContext } from "../lib/context-deps";
import type { DataDB } from "../lib/data-db";
import { buildSkillAttachmentPreview } from "../lib/skill-attachments";
import { findSkillByName, toBirdhouseSkillDetail, toBirdhouseSkillSummary } from "../lib/skills";
import "../types/context";

function validateTriggerPhrases(value: unknown): { ok: true; triggerPhrases: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "trigger_phrases must be an array" };
  }

  const triggerPhrases = value.map((phrase) => {
    if (typeof phrase !== "string") {
      throw new Error("trigger_phrases must be an array of strings");
    }
    return phrase.trim();
  });

  if (triggerPhrases.some((phrase) => phrase === "")) {
    return { ok: false, error: "trigger_phrases must not contain empty strings" };
  }

  if (new Set(triggerPhrases).size !== triggerPhrases.length) {
    return { ok: false, error: "trigger_phrases must not contain duplicates" };
  }

  return { ok: true, triggerPhrases };
}

export function createSkillRoutes(dataDb: DataDB) {
  const app = new Hono();

  app.post("/attachments/preview", async (c) => {
    const { opencode } = getDepsFromContext(c);
    const body = await c.req.json();

    if (typeof body.text !== "string") {
      return c.json({ error: "text is required and must be a string" }, 400);
    }

    const skills = await opencode.listSkills();
    const attachments = buildSkillAttachmentPreview(
      body.text,
      skills.map((skill) => ({
        name: skill.name,
        content: skill.content,
      })),
    );

    return c.json({ attachments });
  });

  app.get("/", async (c) => {
    const { opencode } = getDepsFromContext(c);
    const workspace = c.get("workspace");
    const skills = await opencode.listSkills();

    return c.json({
      skills: skills
        .map((skill) => toBirdhouseSkillSummary(skill, workspace.directory, dataDb.getSkillTriggerPhrases(skill.name)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  });

  app.get("/:skillName", async (c) => {
    const { opencode } = getDepsFromContext(c);
    const workspace = c.get("workspace");
    const skillName = c.req.param("skillName");
    const skills = await opencode.listSkills();
    const skill = findSkillByName(skills, skillName);

    if (!skill) {
      return c.json({ error: `Skill ${skillName} not found` }, 404);
    }

    return c.json(toBirdhouseSkillDetail(skill, workspace.directory, dataDb.getSkillTriggerPhrases(skill.name)));
  });

  app.patch("/:skillName/trigger-phrases", async (c) => {
    const { opencode } = getDepsFromContext(c);
    const skillName = c.req.param("skillName");
    const body = await c.req.json();
    const validated = validateTriggerPhrases(body.trigger_phrases);

    if (!validated.ok) {
      return c.json({ error: validated.error }, 400);
    }

    const skills = await opencode.listSkills();
    const skill = findSkillByName(skills, skillName);
    if (!skill) {
      return c.json({ error: `Skill ${skillName} not found` }, 404);
    }

    dataDb.setSkillTriggerPhrases(skill.name, validated.triggerPhrases);

    return c.json({
      name: skill.name,
      trigger_phrases: validated.triggerPhrases,
    });
  });

  return app;
}
