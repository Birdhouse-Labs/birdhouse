// ABOUTME: Tests for the RemoteAccessSettings component
// ABOUTME: Covers device listing, revocation, inline label editing, and QR pairing modal

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "../services/auth-api";
import RemoteAccessSettings from "./RemoteAccessSettings";

const mockListDevices = vi.fn<() => Promise<Device[]>>();
const mockRevokeDevice = vi.fn<(hash: string) => Promise<void>>();
const mockUpdateDeviceLabel = vi.fn<(hash: string, label: string) => Promise<void>>();
const mockInitiatePairing = vi.fn();

vi.mock("../services/auth-api", () => ({
  listDevices: (...args: Parameters<typeof mockListDevices>) => mockListDevices(...args),
  revokeDevice: (...args: Parameters<typeof mockRevokeDevice>) => mockRevokeDevice(...args),
  updateDeviceLabel: (...args: Parameters<typeof mockUpdateDeviceLabel>) => mockUpdateDeviceLabel(...args),
  initiatePairing: (...args: Parameters<typeof mockInitiatePairing>) => mockInitiatePairing(...args),
}));

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  token_hash: "abc123hash",
  device_label: "my-phone",
  created_at: "2026-06-01T12:00:00.000Z",
  last_used: null,
  is_active: 1,
  user_agent: null,
  ...overrides,
});

describe("RemoteAccessSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockListDevices.mockReturnValue(new Promise(() => {})); // never resolves
    render(() => <RemoteAccessSettings />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no devices are paired", async () => {
    mockListDevices.mockResolvedValue([]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByText(/no paired devices/i)).toBeInTheDocument());
  });

  it("renders device list with explicit label", async () => {
    mockListDevices.mockResolvedValue([
      makeDevice({ device_label: "my-iphone", last_used: "2026-06-10T08:00:00.000Z" }),
    ]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByText("my-iphone")).toBeInTheDocument());
  });

  it("falls back to formatted UA when device_label is null", async () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    mockListDevices.mockResolvedValue([makeDevice({ device_label: null, user_agent: ua })]);
    render(() => <RemoteAccessSettings />);
    // Should show formatted label (macOS · Chrome) not the raw UA
    await waitFor(() => expect(screen.getByText(/chrome/i)).toBeInTheDocument());
  });

  it("shows 'Unknown device' when both device_label and user_agent are null", async () => {
    mockListDevices.mockResolvedValue([makeDevice({ device_label: null, user_agent: null })]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByText(/unknown device/i)).toBeInTheDocument());
  });

  it("shows 'Never' for null last_used", async () => {
    mockListDevices.mockResolvedValue([makeDevice({ last_used: null })]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByText(/never/i)).toBeInTheDocument());
  });

  it("renders a Revoke button per device", async () => {
    mockListDevices.mockResolvedValue([
      makeDevice(),
      makeDevice({ token_hash: "xyz789", device_label: "laptop" }),
    ]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => {
      const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
      expect(revokeButtons).toHaveLength(2);
    });
  });

  it("calls revokeDevice and refreshes list when Revoke is clicked", async () => {
    mockListDevices.mockResolvedValueOnce([makeDevice()]).mockResolvedValueOnce([]);
    mockRevokeDevice.mockResolvedValue(undefined);

    render(() => <RemoteAccessSettings />);
    const revokeBtn = await waitFor(() => screen.getByRole("button", { name: /revoke/i }));

    revokeBtn.click();

    await waitFor(() => {
      expect(mockRevokeDevice).toHaveBeenCalledWith("abc123hash");
      expect(mockListDevices).toHaveBeenCalledTimes(2);
    });
  });

  it("shows input when device label is clicked for editing", async () => {
    mockListDevices.mockResolvedValue([makeDevice({ device_label: "my-phone" })]);
    render(() => <RemoteAccessSettings />);

    const deviceNameBtn = await waitFor(() =>
      screen.getByRole("button", { name: /my-phone/i }),
    );
    deviceNameBtn.click();

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /device name/i })).toBeInTheDocument();
    });
  });

  it("calls updateDeviceLabel on Enter key", async () => {
    mockListDevices.mockResolvedValue([makeDevice({ device_label: "old-name" })]);
    mockUpdateDeviceLabel.mockResolvedValue(undefined);

    render(() => <RemoteAccessSettings />);

    const deviceNameBtn = await waitFor(() =>
      screen.getByRole("button", { name: /old-name/i }),
    );
    deviceNameBtn.click();

    const input = await waitFor(() => screen.getByRole("textbox", { name: /device name/i }));
    // Change value and press Enter
    Object.defineProperty(input, "value", { value: "New Name", writable: true });
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Fire Enter key
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await waitFor(() => {
      expect(mockUpdateDeviceLabel).toHaveBeenCalled();
    });
  });

  it("renders Add Device button", async () => {
    mockListDevices.mockResolvedValue([]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByRole("button", { name: /add device/i })).toBeInTheDocument());
  });

  it("shows pairing modal with URL when Add Device is clicked", async () => {
    mockListDevices.mockResolvedValue([]);
    mockInitiatePairing.mockResolvedValue({
      url: "http://localhost:50100/api/auth/pair/complete?token=abc",
      qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
    });

    render(() => <RemoteAccessSettings />);
    const addBtn = await waitFor(() => screen.getByRole("button", { name: /add device/i }));

    addBtn.click();

    await waitFor(() => {
      expect(screen.getByText(/pair\/complete/)).toBeInTheDocument();
    });
  });

  it("closes modal when close button is clicked", async () => {
    mockListDevices.mockResolvedValue([]);
    mockInitiatePairing.mockResolvedValue({
      url: "http://localhost:50100/api/auth/pair/complete?token=abc",
      qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    });

    render(() => <RemoteAccessSettings />);
    const addBtn = await waitFor(() => screen.getByRole("button", { name: /add device/i }));
    addBtn.click();

    await waitFor(() => screen.getByText(/pair a new device/i));

    const closeBtns = screen.getAllByRole("button", { name: /close/i });
    closeBtns[0].click();

    await waitFor(() => {
      expect(screen.queryByText(/pair a new device/i)).not.toBeInTheDocument();
    });
  });
});
