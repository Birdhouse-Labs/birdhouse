// ABOUTME: Unit tests for McpConfigSection component
// ABOUTME: Tests table rendering, empty state, toggle callbacks, and configure button

import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServers } from "../types/config-types";
import McpConfigSection from "./McpConfigSection";

describe("McpConfigSection", () => {
  const mockOnToggle = vi.fn();
  const mockOnConfigureJson = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to get checkbox in a row by server name
  const getCheckboxByServerName = (serverName: string): HTMLInputElement => {
    const serverCell = screen.getByText(serverName);
    const row = serverCell.closest("tr");
    const checkbox = row?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    return checkbox;
  };

  // Helper function to click checkbox by server name
  // We need to click the label, not the checkbox input directly,
  // because the Checkbox component handles clicks on the label
  const clickCheckboxByServerName = (serverName: string): void => {
    const serverCell = screen.getByText(serverName);
    const row = serverCell.closest("tr");
    const label = row?.querySelector("label") as HTMLElement;
    expect(label).toBeInTheDocument();
    label.click();
  };

  describe("Configure Button", () => {
    it("renders Configure JSON button", () => {
      render(() => (
        <McpConfigSection mcpServers={null} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByRole("button", { name: "Configure JSON" })).toBeInTheDocument();
    });

    it("calls onConfigureJson when Configure JSON button is clicked", () => {
      render(() => (
        <McpConfigSection mcpServers={null} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      screen.getByRole("button", { name: "Configure JSON" }).click();
      expect(mockOnConfigureJson).toHaveBeenCalledOnce();
    });
  });

  describe("Empty State", () => {
    it("shows empty state message when mcpServers is null", () => {
      render(() => (
        <McpConfigSection mcpServers={null} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByText("No MCP servers configured. Click Configure JSON to add.")).toBeInTheDocument();
    });

    it("shows empty state message when mcpServers is empty object", () => {
      render(() => <McpConfigSection mcpServers={{}} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />);

      expect(screen.getByText("No MCP servers configured. Click Configure JSON to add.")).toBeInTheDocument();
    });

    it("does not render table when mcpServers is null", () => {
      render(() => (
        <McpConfigSection mcpServers={null} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("does not render table when mcpServers is empty object", () => {
      render(() => <McpConfigSection mcpServers={{}} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />);

      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("Table Rendering", () => {
    it("renders table with servers", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("filesystem")).toBeInTheDocument();
    });

    it("renders multiple servers in table", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
        },
        github: {
          type: "local",
          command: "npx",
        },
        database: {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByText("filesystem")).toBeInTheDocument();
      expect(screen.getByText("github")).toBeInTheDocument();
      expect(screen.getByText("database")).toBeInTheDocument();
    });

    it("does not show empty state when servers are configured", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.queryByText("No MCP servers configured. Click Configure JSON to add.")).not.toBeInTheDocument();
    });

    it("displays command info for local server", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByText("npx -y @modelcontextprotocol/server-filesystem")).toBeInTheDocument();
    });

    it("displays URL for remote server", () => {
      const servers: McpServers = {
        linear: {
          type: "remote",
          url: "https://mcp.linear.app/sse",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByText("https://mcp.linear.app/sse")).toBeInTheDocument();
    });
  });

  describe("Default Enabled State", () => {
    it("renders checkbox as checked when enabled field is undefined", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          // enabled field not specified
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      const checkbox = getCheckboxByServerName("filesystem");
      expect(checkbox.checked).toBe(true);
    });

    it("renders multiple servers without enabled field as checked by default", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
        },
        github: {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      const filesystemCheckbox = getCheckboxByServerName("filesystem");
      const githubCheckbox = getCheckboxByServerName("github");

      expect(filesystemCheckbox.checked).toBe(true);
      expect(githubCheckbox.checked).toBe(true);
    });
  });

  describe("Explicit Enabled State", () => {
    it("renders checkbox as checked when enabled is true", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          enabled: true,
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      const checkbox = getCheckboxByServerName("filesystem");
      expect(checkbox.checked).toBe(true);
    });

    it("renders checkbox as unchecked when enabled is false", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          enabled: false,
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      const checkbox = getCheckboxByServerName("filesystem");
      expect(checkbox.checked).toBe(false);
    });

    it("handles mix of enabled, disabled, and default servers", () => {
      const servers: McpServers = {
        "enabled-server": {
          type: "local",
          command: "npx",
          enabled: true,
        },
        "disabled-server": {
          type: "local",
          command: "npx",
          enabled: false,
        },
        "default-server": {
          type: "local",
          command: "npx",
          // no enabled field
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      const enabledCheckbox = getCheckboxByServerName("enabled-server");
      const disabledCheckbox = getCheckboxByServerName("disabled-server");
      const defaultCheckbox = getCheckboxByServerName("default-server");

      expect(enabledCheckbox.checked).toBe(true);
      expect(disabledCheckbox.checked).toBe(false);
      expect(defaultCheckbox.checked).toBe(true);
    });
  });

  describe("Toggle Callbacks", () => {
    it("calls onToggle with server name and true when unchecked checkbox is clicked", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          enabled: false,
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      clickCheckboxByServerName("filesystem");

      expect(mockOnToggle).toHaveBeenCalledOnce();
      expect(mockOnToggle).toHaveBeenCalledWith("filesystem", true);
    });

    it("calls onToggle with server name and false when checked checkbox is clicked", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          enabled: true,
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      clickCheckboxByServerName("filesystem");

      expect(mockOnToggle).toHaveBeenCalledOnce();
      expect(mockOnToggle).toHaveBeenCalledWith("filesystem", false);
    });

    it("calls onToggle with false when default enabled server is clicked", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          // no enabled field - defaults to true
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      clickCheckboxByServerName("filesystem");

      expect(mockOnToggle).toHaveBeenCalledOnce();
      expect(mockOnToggle).toHaveBeenCalledWith("filesystem", false);
    });

    it("calls onToggle with correct server name for multiple servers", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
          enabled: true,
        },
        github: {
          type: "local",
          command: "npx",
          enabled: false,
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      clickCheckboxByServerName("filesystem");
      expect(mockOnToggle).toHaveBeenCalledWith("filesystem", false);

      clickCheckboxByServerName("github");
      expect(mockOnToggle).toHaveBeenCalledWith("github", true);

      expect(mockOnToggle).toHaveBeenCalledTimes(2);
    });

    it("does not call onToggle when Configure JSON button is clicked", () => {
      const servers: McpServers = {
        filesystem: {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      screen.getByRole("button", { name: "Configure JSON" }).click();

      expect(mockOnToggle).not.toHaveBeenCalled();
    });
  });

  describe("Server Names Display", () => {
    it("displays server names with special characters correctly", () => {
      const servers: McpServers = {
        "server-with-dashes": {
          type: "local",
          command: "npx",
        },
        server_with_underscores: {
          type: "local",
          command: "npx",
        },
        "server.with.dots": {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      expect(screen.getByText("server-with-dashes")).toBeInTheDocument();
      expect(screen.getByText("server_with_underscores")).toBeInTheDocument();
      expect(screen.getByText("server.with.dots")).toBeInTheDocument();
    });

    it("displays server names in alphabetical order", () => {
      const servers: McpServers = {
        zebra: {
          type: "local",
          command: "npx",
        },
        alpha: {
          type: "local",
          command: "npx",
        },
        beta: {
          type: "local",
          command: "npx",
        },
      };

      render(() => (
        <McpConfigSection mcpServers={servers} onToggle={mockOnToggle} onConfigureJson={mockOnConfigureJson} />
      ));

      // Get all rows (excluding header)
      const rows = screen.getAllByRole("row").slice(1);
      const serverNames = rows.map((row) => {
        const cells = row.querySelectorAll("td");
        return cells[1]?.textContent?.trim() || "";
      });

      // Should be sorted alphabetically
      expect(serverNames).toEqual(["alpha", "beta", "zebra"]);
    });
  });
});
