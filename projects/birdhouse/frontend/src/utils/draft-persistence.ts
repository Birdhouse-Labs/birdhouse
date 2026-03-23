// ABOUTME: Debounced save utility for composer draft persistence
// ABOUTME: Pure TypeScript — no SolidJS primitives

const DEBOUNCE_DELAY_MS = 500;

/**
 * Creates a debounced save mechanism.
 *
 * - schedule(): resets the debounce timer; each call cancels the previous pending timer
 * - flush(): if a timer is pending, cancels it and calls the callback synchronously now;
 *            if no timer is pending, no-op
 */
export function createDebouncedSave(callback: () => void): { schedule: () => void; flush: () => void } {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function schedule(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    timerId = setTimeout(() => {
      timerId = null;
      callback();
    }, DEBOUNCE_DELAY_MS);
  }

  function flush(): void {
    if (timerId === null) {
      return;
    }
    clearTimeout(timerId);
    timerId = null;
    callback();
  }

  return { schedule, flush };
}
