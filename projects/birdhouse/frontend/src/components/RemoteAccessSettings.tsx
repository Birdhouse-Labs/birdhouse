// ABOUTME: Remote Access settings card for managing paired devices
// ABOUTME: Lists active session tokens, supports revoking devices, and initiating QR pairing

import { type Component, createResource, createSignal, For, Show } from "solid-js";
import { type Device, initiatePairing, listDevices, revokeDevice } from "../services/auth-api";
import Button from "./ui/Button";

/**
 * Formats an ISO date string for display. Returns "Never" for null.
 */
function formatDate(isoString: string | null): string {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ==================== Pairing Modal ====================

interface PairingModalProps {
  onClose: () => void;
}

const PairingModal: Component<PairingModalProps> = (props) => {
  const [session] = createResource(initiatePairing);
  let qrRef: HTMLDivElement | undefined;

  // Inject the SVG directly into the container div
  const injectSvg = (svg: string) => {
    if (qrRef) {
      qrRef.innerHTML = svg;
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div class="bg-surface rounded-lg border border-border p-6 max-w-sm w-full mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-text-primary">Pair a New Device</h3>
          <button
            type="button"
            aria-label="Close"
            class="text-text-muted hover:text-text-primary transition-colors"
            onClick={props.onClose}
          >
            ✕
          </button>
        </div>

        <Show when={session.loading}>
          <div class="flex justify-center py-8 text-text-muted text-sm">Loading QR code…</div>
        </Show>

        <Show when={session.error}>
          <div class="p-3 bg-danger/10 border border-danger rounded text-sm text-danger">
            Failed to create pairing session. Please try again.
          </div>
        </Show>

        <Show when={session()}>
          {(s) => (
            <div class="space-y-4">
              {/* QR code SVG */}
              <div
                ref={(el) => {
                  qrRef = el;
                  injectSvg(s().qrSvg);
                }}
                class="flex justify-center [&_svg]:w-48 [&_svg]:h-48 [&_svg]:max-w-full"
                aria-label="QR code for device pairing"
              />

              {/* Expiry note */}
              <p class="text-xs text-text-muted text-center">This code expires in 5 minutes.</p>

              {/* Copyable URL */}
              <div>
                <p class="text-xs font-medium text-text-muted mb-1">Or visit this URL on your device:</p>
                <p class="text-xs text-text-primary font-mono break-all bg-surface-raised border border-border rounded p-2 select-all">
                  {s().url}
                </p>
              </div>
            </div>
          )}
        </Show>

        <div class="mt-5 flex justify-end">
          <Button variant="secondary" onClick={props.onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// ==================== Device Row ====================

interface DeviceRowProps {
  device: Device;
  onRevoke: (hash: string) => Promise<void>;
}

const DeviceRow: Component<DeviceRowProps> = (props) => {
  const [revoking, setRevoking] = createSignal(false);

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await props.onRevoke(props.device.token_hash);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div class="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div class="space-y-0.5">
        <p class="text-sm font-medium text-text-primary">{props.device.device_label}</p>
        <p class="text-xs text-text-muted">
          Added {formatDate(props.device.created_at)}
          {" · "}
          Last used:{" "}
          <span class={props.device.last_used ? "" : "italic"}>
            {formatDate(props.device.last_used)}
          </span>
        </p>
      </div>
      <Button variant="danger" onClick={handleRevoke} disabled={revoking()}>
        {revoking() ? "Revoking…" : "Revoke"}
      </Button>
    </div>
  );
};

// ==================== Main Component ====================

const RemoteAccessSettings: Component = () => {
  const [showPairingModal, setShowPairingModal] = createSignal(false);

  // Devices resource — refetchable after revoke
  const [devices, { refetch }] = createResource(listDevices);

  const handleRevoke = async (hash: string) => {
    await revokeDevice(hash);
    await refetch();
  };

  return (
    <div class="p-6 bg-surface-raised rounded-lg border border-border">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl font-semibold text-text-primary">Remote Access</h2>
          <p class="text-sm text-text-muted mt-1">
            Paired devices can access Birdhouse remotely via a session cookie.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowPairingModal(true)}>
          Add Device
        </Button>
      </div>

      {/* Loading */}
      <Show when={devices.loading}>
        <p class="text-sm text-text-muted">Loading…</p>
      </Show>

      {/* Error */}
      <Show when={devices.error}>
        <p class="text-sm text-danger">Failed to load devices.</p>
      </Show>

      {/* Empty state */}
      <Show when={!devices.loading && !devices.error && devices()?.length === 0}>
        <p class="text-sm text-text-muted italic">No paired devices.</p>
      </Show>

      {/* Device list */}
      <Show when={devices() && devices()!.length > 0}>
        <div>
          <For each={devices()}>
            {(device) => <DeviceRow device={device} onRevoke={handleRevoke} />}
          </For>
        </div>
      </Show>

      {/* Pairing modal */}
      <Show when={showPairingModal()}>
        <PairingModal onClose={() => setShowPairingModal(false)} />
      </Show>
    </div>
  );
};

export default RemoteAccessSettings;
