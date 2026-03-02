// ABOUTME: Clipboard utility with Safari-compatible fallback for HTTP contexts
// ABOUTME: Uses modern Clipboard API with automatic fallback to execCommand for broader compatibility

/**
 * Copy text to clipboard with automatic fallback for HTTP contexts and Safari
 * @param text - The text to copy to clipboard
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  // Strategy 1: Try modern Clipboard API first (works on HTTPS and localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_err) {
      // Fall through to fallback method
    }
  }

  // Strategy 2: Fallback to execCommand (works on HTTP, all contexts)
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;

    // Prevent scrolling and visual flash
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.fontSize = "16px"; // Prevent zoom on iOS
    textarea.readOnly = true;

    document.body.appendChild(textarea);

    // iOS requires special handling
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, text.length);
    } else {
      textarea.select();
      textarea.setSelectionRange(0, text.length);
    }

    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);

    return successful;
  } catch (_err) {
    return false;
  }
}
