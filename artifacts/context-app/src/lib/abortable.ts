/** Bound non-fetch work (such as session-token retrieval) to the request deadline. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cancelled = () => reject(signal.reason ?? new DOMException("Request cancelled", "AbortError"));
    if (signal.aborted) { cancelled(); void promise.catch(() => {}); return; }
    signal.addEventListener("abort", cancelled, { once: true });
    promise.then(value => { signal.removeEventListener("abort", cancelled); resolve(value); }, error => {
      signal.removeEventListener("abort", cancelled); reject(error);
    });
  });
}
