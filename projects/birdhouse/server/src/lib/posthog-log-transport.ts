// ABOUTME: Batches warn/error/fatal log entries and ships them to PostHog via OTLP/HTTP
// ABOUTME: Prod-only, fire-and-forget — failures never affect the server

const POSTHOG_LOGS_URL = "https://us.i.posthog.com/i/v1/logs";
const POSTHOG_PROJECT_TOKEN = "phc_LwyUqyfUjlP28aI98eE2K7jA6mdTboPZYRuKotWsoYI";
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 50;

/** OTLP severity numbers for the levels we ship */
const SEVERITY_NUMBERS: Record<string, number> = {
  warn: 13,
  error: 17,
  fatal: 21,
};

/** Pino level names we forward to PostHog — debug/info/trace stay local */
const FORWARDED_LEVELS = new Set(["warn", "error", "fatal"]);

interface OtlpAttribute {
  key: string;
  value: { stringValue: string } | { intValue: number } | { boolValue: boolean };
}

interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: OtlpAttribute[];
}

/** Parse a raw pino JSON line into an OTLP log record, or null if it should be skipped */
function parsePinoLine(line: string): OtlpLogRecord | null {
  let entry: Record<string, unknown>;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }

  const level = entry.level as string | undefined;
  if (!level || !FORWARDED_LEVELS.has(level)) return null;

  const msg = (entry.msg as string) ?? "";
  const time = (entry.time as string) ?? new Date().toISOString();
  const subsystem = (entry.subsystem as string) ?? "unknown";

  // Convert ISO timestamp to nanoseconds
  const timeUnixNano = String(new Date(time).getTime() * 1_000_000);

  // Build attributes from structured fields, excluding high-cardinality or sensitive ones
  const attributes: OtlpAttribute[] = [{ key: "subsystem", value: { stringValue: subsystem } }];

  // Include workspaceId if present (useful for debugging)
  if (typeof entry.workspaceId === "string") {
    attributes.push({ key: "workspaceId", value: { stringValue: entry.workspaceId } });
  }

  // Include path and status for API errors
  if (typeof entry.path === "string") {
    attributes.push({ key: "path", value: { stringValue: entry.path } });
  }
  if (typeof entry.status === "number") {
    attributes.push({ key: "status", value: { intValue: entry.status } });
  }

  // Include error message if present
  if (entry.err && typeof (entry.err as Record<string, unknown>).message === "string") {
    attributes.push({
      key: "error.message",
      value: { stringValue: (entry.err as Record<string, unknown>).message as string },
    });
  }

  return {
    timeUnixNano,
    severityNumber: SEVERITY_NUMBERS[level] ?? 13,
    severityText: level.toUpperCase(),
    body: { stringValue: msg },
    attributes,
  };
}

/** Build the OTLP/JSON payload for a batch of log records */
function buildOtlpPayload(records: OtlpLogRecord[]): object {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: "birdhouse-server" } }],
        },
        scopeLogs: [
          {
            scope: { name: "birdhouse" },
            logRecords: records,
          },
        ],
      },
    ],
  };
}

/** Ship a batch to PostHog — fire and forget, errors are silently ignored */
async function flush(batch: OtlpLogRecord[]): Promise<void> {
  if (batch.length === 0) return;

  try {
    await fetch(POSTHOG_LOGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${POSTHOG_PROJECT_TOKEN}`,
      },
      body: JSON.stringify(buildOtlpPayload(batch)),
    });
  } catch {
    // Intentionally swallowed — PostHog transport must never affect the server
  }
}

/**
 * Create a writable stream that intercepts pino JSON lines, filters to
 * warn/error/fatal, batches them, and ships to PostHog on an interval.
 *
 * Returns the stream and a shutdown function to flush the remaining batch.
 */
export function createPosthogLogTransport(): {
  write: (chunk: string) => void;
  shutdown: () => Promise<void>;
} {
  const pending: OtlpLogRecord[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;

  function scheduledFlush() {
    const batch = pending.splice(0, MAX_BATCH_SIZE);
    void flush(batch);
  }

  timer = setInterval(scheduledFlush, FLUSH_INTERVAL_MS);
  // Allow the process to exit without waiting for the timer
  if (timer.unref) timer.unref();

  return {
    write(chunk: string) {
      const record = parsePinoLine(chunk.trim());
      if (record) pending.push(record);
    },

    async shutdown() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await flush(pending.splice(0));
    },
  };
}
