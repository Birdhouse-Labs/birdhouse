// ABOUTME: Tests for the RemoteAccessSettings component
// ABOUTME: Covers device listing, revocation, and QR pairing modal

import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "../services/auth-api";
import RemoteAccessSettings from "./RemoteAccessSettings";

const mockListDevices = vi.fn<() => Promise<Device[]>>();
const mockRevokeDevice = vi.fn<(hash: string) => Promise<void>>();
const mockInitiatePairing = vi.fn();

vi.mock("../services/auth-api", () => ({
  listDevices: (...args: Parameters<typeof mockListDevices>) => mockListDevices(...args),
  revokeDevice: (...args: Parameters<typeof mockRevokeDevice>) => mockRevokeDevice(...args),
  initiatePairing: (...args: Parameters<typeof mockInitiatePairing>) => mockInitiatePairing(...args),
}));

const makeDevice = (overrides: Partial<Device> = {}): Device => ({
  token_hash: "abc123hash",
  device_label: "my-phone",
  created_at: "2026-06-01T12:00:00.000Z",
  last_used: null,
  is_active: 1,
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

  it("renders device list with label", async () => {
    mockListDevices.mockResolvedValue([
      makeDevice({ device_label: "my-iphone", last_used: "2026-06-10T08:00:00.000Z" }),
    ]);
    render(() => <RemoteAccessSettings />);
    await waitFor(() => expect(screen.getByText("my-iphone")).toBeInTheDocument());
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
      // Pairing URL should be visible
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

    // Wait for pairing modal to appear (it shows a "Pair a New Device" heading)
    await waitFor(() => screen.getByText(/pair a new device/i));

    // The ✕ icon button has aria-label="Close"; clicking it should hide the modal
    const closeBtns = screen.getAllByRole("button", { name: /close/i });
    closeBtns[0].click();

    await waitFor(() => {
      expect(screen.queryByText(/pair a new device/i)).not.toBeInTheDocument();
    });
  });
});
