// ABOUTME: Formats a User-Agent string into a human-readable device label
// ABOUTME: Uses bowser to parse UA; produces "OS · Browser" or "Vendor Model · Browser"

import Bowser from "bowser";

/**
 * Formats a User-Agent string into a human-readable device label.
 *
 * Examples:
 *   "iPhone; Safari 17"   → "Apple iPhone · Safari"
 *   "Android; Chrome"     → "Android · Chrome"
 *   "macOS; Chrome"       → "macOS · Chrome"
 *   "Windows 10; Edge"    → "Windows · Edge"
 *
 * Returns "Unknown device" when the UA is null, empty, or unrecognizable.
 */
export function formatDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";

  let result: ReturnType<ReturnType<typeof Bowser.getParser>["getResult"]>;
  try {
    result = Bowser.getParser(userAgent).getResult();
  } catch {
    return "Unknown device";
  }

  const browserName = result.browser?.name;
  const osName = result.os?.name;
  const platformType = result.platform?.type; // "mobile" | "tablet" | "desktop" | undefined
  const vendor = result.platform?.vendor;
  const model = result.platform?.model;

  // Determine the device descriptor
  let device: string | undefined;

  if (platformType === "mobile" || platformType === "tablet") {
    if (vendor && model) {
      device = `${vendor} ${model}`;
    } else if (osName) {
      device = osName;
    }
  } else {
    // Desktop or unknown platform type
    device = osName;
  }

  // Build the final label
  if (device && browserName) {
    return `${device} · ${browserName}`;
  }
  if (device) {
    return device;
  }
  if (browserName) {
    return browserName;
  }
  return "Unknown device";
}
