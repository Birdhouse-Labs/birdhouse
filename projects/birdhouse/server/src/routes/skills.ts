// ABOUTME: Workspace-scoped API routes for listing visible OpenCode skills and Birdhouse trigger phrases.
// ABOUTME: Normalizes OpenCode skill data into Birdhouse responses and stores trigger phrases by skill name.

import { dirname } from "node:path";
import { Hono } from "hono";
import { getDepsFromContext } from "../lib/context-deps";
import type { DataDB } from "../lib/data-db";
import { broadcastToAllWorkspaces } from "../lib/opencode-stream";
import { buildSkillAttachmentPreview } from "../lib/skill-attachments";
import {
  findSkillByName,
  revealDirectoryInFileManager,
  toBirdhouseSkillDetail,
  toBirdhouseSkillSummary,
} from "../lib/skills";
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
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;
    const body = await c.req.json();

    if (typeof body.text !== "string") {
      return c.json({ error: "text is required and must be a string" }, 400);
    }

    const skills = (await skillsCapability?.listSkills()) ?? [];
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
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;
    const workspace = c.get("workspace");
    const skills = (await skillsCapability?.listSkills()) ?? [];

    return c.json({
      skills: skills
        .map((skill) => toBirdhouseSkillSummary(skill, workspace.directory, dataDb.getSkillTriggerPhrases(skill.name)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  });

  app.get("/:skillName", async (c) => {
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;
    const workspace = c.get("workspace");
    const skillName = c.req.param("skillName");
    const skills = (await skillsCapability?.listSkills()) ?? [];
    const skill = findSkillByName(skills, skillName);

    if (!skill) {
      return c.json({ error: `Skill ${skillName} not found` }, 404);
    }

    return c.json(await toBirdhouseSkillDetail(skill, workspace.directory, dataDb.getSkillTriggerPhrases(skill.name)));
  });

  app.post("/reload", async (c) => {
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;

    await skillsCapability?.reloadSkills();

    return c.json({ success: true });
  });

  app.patch("/:skillName/trigger-phrases", async (c) => {
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;
    const skillName = c.req.param("skillName");
    const body = await c.req.json();
    const validated = validateTriggerPhrases(body.trigger_phrases);

    if (!validated.ok) {
      return c.json({ error: validated.error }, 400);
    }

    const skills = (await skillsCapability?.listSkills()) ?? [];
    const skill = findSkillByName(skills, skillName);
    if (!skill) {
      return c.json({ error: `Skill ${skillName} not found` }, 404);
    }

    dataDb.setSkillTriggerPhrases(skill.name, validated.triggerPhrases);
    broadcastToAllWorkspaces("birdhouse.skill.updated", {
      skillName: skill.name,
    });

    return c.json({
      name: skill.name,
      trigger_phrases: validated.triggerPhrases,
    });
  });

  app.post("/:skillName/reveal", async (c) => {
    const { harness } = getDepsFromContext(c);
    const skillsCapability = harness.capabilities.skills;
    const skillName = c.req.param("skillName");
    const skills = (await skillsCapability?.listSkills()) ?? [];
    const skill = findSkillByName(skills, skillName);

    if (!skill) {
      return c.json({ error: `Skill ${skillName} not found` }, 404);
    }

    const directory = dirname(skill.location);
    revealDirectoryInFileManager(directory);

    return c.json({ success: true, path: directory });
  });

  return app;
}
