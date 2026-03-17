// ABOUTME: Tests SkillCacheProvider refresh behavior for skill cache invalidation.
// ABOUTME: Verifies SSE-driven refetch keeps composer skill suggestions current.

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillCacheProvider, useSkillCache } from "./SkillCacheContext";

const { connectionEstablishedHandlers, skillUpdatedHandlers, fetchSkillLibraryMock } = vi.hoisted(() => ({
  connectionEstablishedHandlers: [] as Array<() => void>,
  skillUpdatedHandlers: [] as Array<(payload: { skillName: string }) => void>,
  fetchSkillLibraryMock: vi.fn(),
}));

vi.mock("./WorkspaceContext", () => ({
  useWorkspace: () => ({ workspaceId: "ws_test" }),
}));

vi.mock("./StreamingContext", () => ({
  useStreaming: () => ({
    subscribeToConnectionEstablished: (handler: () => void) => {
      connectionEstablishedHandlers.push(handler);
      return () => {
        const index = connectionEstablishedHandlers.indexOf(handler);
        if (index >= 0) {
          connectionEstablishedHandlers.splice(index, 1);
        }
      };
    },
    subscribeToSkillUpdated: (handler: (payload: { skillName: string }) => void) => {
      skillUpdatedHandlers.push(handler);
      return () => {
        const index = skillUpdatedHandlers.indexOf(handler);
        if (index >= 0) {
          skillUpdatedHandlers.splice(index, 1);
        }
      };
    },
  }),
}));

vi.mock("../skills/services/skill-library-api", () => ({
  fetchSkillLibrary: fetchSkillLibraryMock,
}));

function SkillCacheConsumer() {
  const skillCache = useSkillCache();

  return (
    <div>
      <div data-testid="skills">
        {skillCache
          .skills()
          .map((skill) => `${skill.id}:${skill.triggerPhrases.join(",")}`)
          .join("|")}
      </div>
    </div>
  );
}

describe("SkillCacheProvider", () => {
  beforeEach(() => {
    fetchSkillLibraryMock.mockReset();
    connectionEstablishedHandlers.length = 0;
    skillUpdatedHandlers.length = 0;
  });

  it("refetches cached skills when birdhouse.skill.updated arrives", async () => {
    fetchSkillLibraryMock
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["docs please"],
          },
        ],
      })
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["reference the docs"],
          },
        ],
      });

    render(() => (
      <SkillCacheProvider>
        <SkillCacheConsumer />
      </SkillCacheProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("skills").textContent).toBe("find-docs:docs please");
    });

    expect(skillUpdatedHandlers).toHaveLength(1);
    const skillUpdatedHandler = skillUpdatedHandlers[0];
    expect(skillUpdatedHandler).toBeDefined();
    skillUpdatedHandler?.({ skillName: "find-docs" });

    await waitFor(() => {
      expect(fetchSkillLibraryMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("skills").textContent).toBe("find-docs:reference the docs");
    });
  });

  it("keeps refetching on connection re-established", async () => {
    fetchSkillLibraryMock
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["docs please"],
          },
        ],
      })
      .mockResolvedValueOnce({
        skills: [
          {
            id: "find-docs",
            title: "find-docs",
            trigger_phrases: ["search the docs"],
          },
        ],
      });

    render(() => (
      <SkillCacheProvider>
        <SkillCacheConsumer />
      </SkillCacheProvider>
    ));

    await waitFor(() => {
      expect(screen.getByTestId("skills").textContent).toBe("find-docs:docs please");
    });

    expect(connectionEstablishedHandlers).toHaveLength(1);
    const connectionEstablishedHandler = connectionEstablishedHandlers[0];
    expect(connectionEstablishedHandler).toBeDefined();
    connectionEstablishedHandler?.();

    await waitFor(() => {
      expect(fetchSkillLibraryMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("skills").textContent).toBe("find-docs:search the docs");
    });
  });
});
