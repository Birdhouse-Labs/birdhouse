// ABOUTME: Debounced save utility for composer draft persistence
// ABOUTME: Pure TypeScript — no SolidJS primitives

const DEBOUNCE_DELAY_MS = 500;

/**
 * Creates a debounced save mechanism.
 *
 * - schedule(): resets the debounce timer; each call cancels the previous pending timer
 * - cancel(): clears any pending timer without invoking the callback
 * - flush(): if a timer is pending, cancels it and calls the callback synchronously now;
 *            if no timer is pending, no-op
 */
export function createDebouncedSave(callback: () => void): {
  schedule: () => void;
  cancel: () => void;
  flush: () => void;
} {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function schedule(): void {
    cancel();
    timerId = setTimeout(() => {
      timerId = null;
      callback();
    }, DEBOUNCE_DELAY_MS);
  }

  function cancel(): void {
    if (timerId === null) {
      return;
    }
    clearTimeout(timerId);
    timerId = null;
  }

  function flush(): void {
    if (timerId === null) {
      return;
    }
    cancel();
    callback();
  }

  return { schedule, cancel, flush };
}
