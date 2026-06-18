// ABOUTME: Remote Access settings card for managing paired devices
// ABOUTME: Lists active session tokens, supports revoking devices, and initiating QR pairing

import Tooltip from "corvu/tooltip";
import { Copy, Info } from "lucide-solid";
import { type Component, createResource, createSignal, For, onMount, Show } from "solid-js";
import { type Device, initiatePairing, listDevices, revokeDevice } from "../services/auth-api";
import Button from "./ui/Button";

const EXTERNAL_URL_KEY = "birdhouse.remoteAccess.externalUrl";

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

// ==================== Copy Row ====================

/** A labeled value row with an inline copy button. */
const CopyRow: Component<{ label: string; value: string; mono?: boolean; truncate?: boolean }> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p class="text-xs font-medium text-text-muted mb-1">{props.label}</p>
      <div class="flex items-center gap-2 bg-surface-raised border border-border rounded px-3 py-2">
        <span
          class="flex-1 text-xs text-text-primary min-w-0"
          classList={{
            "font-mono": !!props.mono,
            "truncate": !!props.truncate,
            "break-all": !props.truncate,
          }}
          title={props.truncate ? props.value : undefined}
        >
          {props.value}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${props.label}`}
          class="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
        >
          <Copy size={14} />
        </button>
        <Show when={copied()}>
          <span class="text-xs text-accent flex-shrink-0">Copied!</span>
        </Show>
      </div>
    </div>
  );
};

// ==================== Pairing Modal ====================

interface PairingModalProps {
  externalUrl: string;
  onClose: () => void;
}

const PairingModal: Component<PairingModalProps> = (props) => {
  // Pass the externalUrl at mount time so the resource fetches with the right value.
  // We capture it once — the URL doesn't change while the modal is open.
  const [session] = createResource(() => props.externalUrl, initiatePairing);
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
          {(s) => {
            const token = () => {
              try { return new URL(s().url).searchParams.get("token") ?? ""; }
              catch { return ""; }
            };
            return (
              <div class="space-y-4">
                {/* QR code SVG */}
                <div
                  ref={(el) => { qrRef = el; injectSvg(s().qrSvg); }}
                  class="flex justify-center [&_svg]:w-48 [&_svg]:h-48 [&_svg]:max-w-full"
                  aria-label="QR code for device pairing"
                />

                {/* Expiry note */}
                <p class="text-xs text-text-muted text-center">This code expires in 5 minutes.</p>

                {/* URL row */}
                <CopyRow label="URL" value={s().url} mono truncate />

                {/* Token row */}
                <Show when={token()}>
                  <CopyRow label="Token" value={token()} mono />
                </Show>
              </div>
            );
          }}
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
  const [externalUrl, setExternalUrl] = createSignal("");

  // Load persisted external URL on mount
  onMount(() => {
    const saved = localStorage.getItem(EXTERNAL_URL_KEY);
    if (saved) setExternalUrl(saved);
  });

  const handleExternalUrlBlur = (value: string) => {
    const trimmed = value.trim();
    setExternalUrl(trimmed);
    if (trimmed) {
      localStorage.setItem(EXTERNAL_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(EXTERNAL_URL_KEY);
    }
  };

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

      {/* External URL input */}
      <div class="mb-6">
        <div class="flex items-center gap-1.5 mb-1">
          <label for="external-url-input" class="text-sm font-medium text-text-primary">
            External URL
          </label>
          <Tooltip openDelay={200} closeDelay={0} placement="top">
            <Tooltip.Trigger
              as="button"
              type="button"
              aria-label="External URL info"
              class="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
            >
              <Info size={14} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content class="z-50 max-w-xs rounded-lg border border-border bg-surface-overlay px-3 py-2 text-xs text-text-primary shadow-xl leading-relaxed">
                The URL your phone will use to reach this machine, including the port — e.g.{" "}
                <code class="font-mono">https://home.example.com:50100</code> or{" "}
                <code class="font-mono">http://100.x.x.x:50100</code>. Leave blank to use the
                local address. Works with Tailscale IPs, custom domains, or tunnel services like
                Cloudflare Tunnel or ngrok.
                <Tooltip.Arrow style={{ color: "var(--color-surface-overlay)" }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip>
        </div>

        <input
          id="external-url-input"
          type="url"
          class="w-full text-sm bg-surface border border-border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="https://yourdomain.com:50100 or http://100.x.x.x:50100"
          value={externalUrl()}
          onInput={(e) => setExternalUrl(e.currentTarget.value)}
          onBlur={(e) => handleExternalUrlBlur(e.currentTarget.value)}
        />
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
        <PairingModal
          externalUrl={externalUrl()}
          onClose={() => setShowPairingModal(false)}
        />
      </Show>
    </div>
  );
};

export default RemoteAccessSettings;
