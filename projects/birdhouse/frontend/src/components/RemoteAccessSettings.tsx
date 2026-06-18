// ABOUTME: Remote Access settings card for managing paired devices
// ABOUTME: Lists active session tokens, supports revoking devices, and initiating QR pairing

import Tooltip from "corvu/tooltip";
import { Copy, Info, Pencil } from "lucide-solid";
import { type Component, createResource, createSignal, For, onMount, Show } from "solid-js";
import { formatDeviceLabel } from "../lib/device-label";
import { type Device, initiatePairing, listDevices, revokeDevice, updateDeviceLabel } from "../services/auth-api";
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
  const [session] = createResource(() => props.externalUrl, initiatePairing);
  let qrRef: HTMLDivElement | undefined;

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
                <div
                  ref={(el) => { qrRef = el; injectSvg(s().qrSvg); }}
                  class="flex justify-center [&_svg]:w-48 [&_svg]:h-48 [&_svg]:max-w-full"
                  aria-label="QR code for device pairing"
                />
                <p class="text-xs text-text-muted text-center">This code expires in 5 minutes.</p>
                <CopyRow label="URL" value={s().url} mono truncate />
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
  onLabelUpdate: (hash: string, label: string) => Promise<void>;
}

const DeviceRow: Component<DeviceRowProps> = (props) => {
  const displayLabel = () =>
    props.device.device_label ?? formatDeviceLabel(props.device.user_agent);

  const [revoking, setRevoking] = createSignal(false);
  const [isEditing, setIsEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const startEdit = () => {
    setEditValue(displayLabel());
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const commitEdit = async () => {
    const newLabel = editValue().trim();
    if (!newLabel || newLabel === displayLabel()) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await props.onLabelUpdate(props.device.token_hash, newLabel);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

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
      <div class="space-y-0.5 flex-1 min-w-0 mr-4">
        <Show
          when={isEditing()}
          fallback={
            <button
              type="button"
              class="group flex items-center gap-1.5 text-left"
              onClick={startEdit}
              title="Click to rename"
            >
              <span class="text-sm font-medium text-text-primary truncate">
                {displayLabel()}
              </span>
              <span class="opacity-0 group-hover:opacity-100 transition-opacity text-text-muted flex-shrink-0">
                <Pencil size={12} />
              </span>
            </button>
          }
        >
          <input
            type="text"
            class="text-sm font-medium text-text-primary bg-surface border border-accent rounded px-2 py-0.5 w-full focus:outline-none"
            value={editValue()}
            onInput={(e) => setEditValue(e.currentTarget.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={handleKeyDown}
            disabled={saving()}
            ref={(el) => {
              // Focus when editing starts
              setTimeout(() => el?.focus(), 0);
            }}
            aria-label="Device name"
          />
        </Show>
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

  const [devices, { refetch }] = createResource(listDevices);

  // Optimistic label update: patch device in local state, refetch only on error
  const [labelOverrides, setLabelOverrides] = createSignal<Record<string, string>>({});

  const handleLabelUpdate = async (hash: string, label: string) => {
    // Optimistically apply
    setLabelOverrides((prev) => ({ ...prev, [hash]: label }));
    try {
      await updateDeviceLabel(hash, label);
    } catch {
      // Revert optimistic update and refetch
      setLabelOverrides((prev) => {
        const next = { ...prev };
        delete next[hash];
        return next;
      });
      await refetch();
    }
  };

  const handleRevoke = async (hash: string) => {
    await revokeDevice(hash);
    // Clear any label override for revoked device
    setLabelOverrides((prev) => {
      const next = { ...prev };
      delete next[hash];
      return next;
    });
    await refetch();
  };

  // Merge optimistic overrides into device list
  const devicesWithOverrides = () => {
    const list = devices();
    if (!list) return list;
    const overrides = labelOverrides();
    if (Object.keys(overrides).length === 0) return list;
    return list.map((d) =>
      d.token_hash in overrides ? { ...d, device_label: overrides[d.token_hash] } : d,
    );
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

      <Show when={devices.loading}>
        <p class="text-sm text-text-muted">Loading…</p>
      </Show>

      <Show when={devices.error}>
        <p class="text-sm text-danger">Failed to load devices.</p>
      </Show>

      <Show when={!devices.loading && !devices.error && devices()?.length === 0}>
        <p class="text-sm text-text-muted italic">No paired devices.</p>
      </Show>

      <Show when={devicesWithOverrides() && devicesWithOverrides()!.length > 0}>
        <div>
          <For each={devicesWithOverrides()}>
            {(device) => (
              <DeviceRow
                device={device}
                onRevoke={handleRevoke}
                onLabelUpdate={handleLabelUpdate}
              />
            )}
          </For>
        </div>
      </Show>

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
