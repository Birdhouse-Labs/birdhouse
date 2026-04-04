// ABOUTME: Tests for question endpoints - listing pending questions and replying to them
// ABOUTME: Covers GET /agents/:id/questions and POST /agents/:id/questions/:requestId/reply

import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDeps, withDeps } from "../../dependencies";
import { createTestAgentHarness } from "../../harness";
import { type AgentsDB, initAgentsDB } from "../../lib/agents-db";
import type { QuestionRequest } from "../../lib/opencode-client";
import { createRootAgent, createTestApp } from "../../test-utils";
import { getAgentQuestions, replyToAgentQuestion } from "./question";

describe("getAgentQuestions", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  test("returns 404 for unknown agent", async () => {
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request("/agent_unknown/questions");
      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("returns empty array when no pending questions", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps({
      listPendingQuestions: async () => [],
      getSessionStatus: async () => ({ ses_1: { type: "busy" } }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as QuestionRequest[];
      expect(data).toEqual([]);
    });
  });

  test("returns 501 when questions capability is absent", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness = createTestAgentHarness({ enableQuestions: false });

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(501);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Questions not supported by harness");
    });
  });

  test("filters questions to only those matching the agent's session_id", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const matchingQuestion: QuestionRequest = {
      id: "req_1",
      sessionID: "ses_1",
      questions: [
        {
          question: "Which approach?",
          header: "Approach",
          options: [
            { label: "Option A", description: "The first option" },
            { label: "Option B", description: "The second option" },
          ],
        },
      ],
    };

    const otherSessionQuestion: QuestionRequest = {
      id: "req_2",
      sessionID: "ses_other",
      questions: [
        {
          question: "Different agent question?",
          header: "Other",
          options: [{ label: "Yes", description: "Yes" }],
        },
      ],
    };

    const deps = await createTestDeps({
      listPendingQuestions: async () => [matchingQuestion, otherSessionQuestion],
      getSessionStatus: async () => ({ ses_1: { type: "busy" } }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as QuestionRequest[];
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("req_1");
      expect(data[0].sessionID).toBe("ses_1");
    });
  });

  test("returns empty array when session is idle even if OpenCode has pending questions", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const pendingQuestion: QuestionRequest = {
      id: "req_1",
      sessionID: "ses_1",
      questions: [{ question: "Which approach?", header: "Approach", options: [] }],
    };

    const deps = await createTestDeps({
      listPendingQuestions: async () => [pendingQuestion],
      // Session is idle — question is a leaked promise from an aborted run
      getSessionStatus: async () => ({ ses_1: { type: "idle" } }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as QuestionRequest[];
      expect(data).toEqual([]);
    });
  });

  test("returns empty array when session is not in status map (defaults to idle)", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const pendingQuestion: QuestionRequest = {
      id: "req_1",
      sessionID: "ses_1",
      questions: [{ question: "Which approach?", header: "Approach", options: [] }],
    };

    const deps = await createTestDeps({
      listPendingQuestions: async () => [pendingQuestion],
      // Session not in map — treated as idle
      getSessionStatus: async () => ({}),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as QuestionRequest[];
      expect(data).toEqual([]);
    });
  });

  test("returns multiple questions when agent has multiple pending", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const question1: QuestionRequest = {
      id: "req_1",
      sessionID: "ses_1",
      questions: [{ question: "Q1?", header: "Q1", options: [] }],
    };
    const question2: QuestionRequest = {
      id: "req_2",
      sessionID: "ses_1",
      questions: [{ question: "Q2?", header: "Q2", options: [] }],
    };

    const deps = await createTestDeps({
      listPendingQuestions: async () => [question1, question2],
      getSessionStatus: async () => ({ ses_1: { type: "busy" } }),
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.get("/:id/questions", (c) => getAgentQuestions(c, deps));

      const response = await app.request(`/${agent.id}/questions`);
      expect(response.status).toBe(200);
      const data = (await response.json()) as QuestionRequest[];
      expect(data).toHaveLength(2);
    });
  });
});

describe("replyToAgentQuestion", () => {
  let agentsDB: AgentsDB;

  beforeEach(async () => {
    agentsDB = await initAgentsDB(":memory:");
  });

  test("returns 404 for unknown agent", async () => {
    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request("/agent_unknown/questions/req_1/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [["Option A"]] }),
      });
      expect(response.status).toBe(404);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("not found");
    });
  });

  test("returns 400 when answers is missing from body", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request(`/${agent.id}/questions/req_1/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("answers");
    });
  });

  test("returns 400 when answers is not an array", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request(`/${agent.id}/questions/req_1/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: "not an array" }),
      });
      expect(response.status).toBe(400);
      const data = (await response.json()) as { error: string };
      expect(data.error).toContain("answers");
    });
  });

  test("calls replyToQuestion with correct requestID and answers", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    let capturedRequestID: string | undefined;
    let capturedAnswers: string[][] | undefined;

    const deps = await createTestDeps({
      replyToQuestion: async (requestID: string, answers: string[][]) => {
        capturedRequestID = requestID;
        capturedAnswers = answers;
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request(`/${agent.id}/questions/req_42/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [["Option A"], ["custom answer"]] }),
      });
      expect(response.status).toBe(200);
      expect(capturedRequestID).toBe("req_42");
      expect(capturedAnswers).toEqual([["Option A"], ["custom answer"]]);
    });
  });

  test("returns 501 when reply capability is absent", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps();
    deps.agentsDB = agentsDB;
    deps.harness = createTestAgentHarness({ enableQuestions: false });

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request(`/${agent.id}/questions/req_1/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [["Option A"]] }),
      });
      expect(response.status).toBe(501);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Questions not supported by harness");
    });
  });

  test("proxies error status when replyToQuestion throws", async () => {
    const agent = createRootAgent(agentsDB, {
      id: "agent_1",
      session_id: "ses_1",
      title: "Test Agent",
    });

    const deps = await createTestDeps({
      replyToQuestion: async () => {
        throw new Error("Not Found");
      },
    });
    deps.agentsDB = agentsDB;

    await withDeps(deps, async () => {
      const app = await createTestApp({ agentsDb: agentsDB });
      app.post("/:id/questions/:requestId/reply", (c) => replyToAgentQuestion(c, deps));

      const response = await app.request(`/${agent.id}/questions/req_1/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [["Option A"]] }),
      });
      expect(response.status).toBe(500);
      const data = (await response.json()) as { error: string };
      expect(data.error).toBe("Not Found");
    });
  });
});
