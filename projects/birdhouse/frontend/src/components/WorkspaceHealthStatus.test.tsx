// ABOUTME: Unit tests for workspace health tooltip content
// ABOUTME: Verifies online tooltip details include OpenCode port and PID order

import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import WorkspaceHealthStatus from "./WorkspaceHealthStatus";

describe("WorkspaceHealthStatus", () => {
  it("shows port on its own line above PID in the online tooltip", async () => {
    render(() => (
      <WorkspaceHealthStatus
        workspaceId="ws-123"
        health={{
          workspaceId: "ws-123",
          opencodeRunning: true,
          port: 3001,
          pid: 12345,
          error: null,
          lastChecked: Date.now(),
        }}
        isChecking={false}
        onEditConfig={vi.fn()}
      />
    ));

    fireEvent.mouseEnter(screen.getByText(/Online/));

    const tooltip = await waitFor(() => {
      const content = screen.getByText((text, element) => {
        return element?.tagName.toLowerCase() === "pre" && text.includes("Status: Online");
      });

      expect(content).toBeInTheDocument();
      return content;
    });

    expect(tooltip.textContent).toContain("Port: 3001");
    expect(tooltip.textContent).toContain("PID: 12345");
    expect(tooltip.textContent?.indexOf("Port: 3001")).toBeLessThan(tooltip.textContent?.indexOf("PID: 12345") ?? -1);
  });
});
