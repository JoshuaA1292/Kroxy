const RETRY_DELAYS = [500, 1000, 2000];

/**
 * fetch with exponential backoff retry and per-attempt timeout.
 *
 * Retries on:
 *   - TypeError (network / DNS failure)
 *   - HTTP 429 Too Many Requests (respects Retry-After header, cap 30s)
 *   - HTTP 503 Service Unavailable
 *
 * Does NOT retry on other 4xx or 500/502.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (resp.ok) return resp;

      if ((resp.status === 429 || resp.status === 503) && attempt < 2) {
        let delay = RETRY_DELAYS[attempt];
        if (resp.status === 429) {
          const retryAfter = resp.headers.get('Retry-After');
          if (retryAfter) {
            const secs = parseFloat(retryAfter);
            if (!isNaN(secs)) delay = Math.min(secs * 1000, 30_000);
          }
        }
        await sleep(delay);
        continue;
      }

      return resp;
    } catch (err: unknown) {
      clearTimeout(timer);

      const isAbort =
        err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      const isNetwork = err instanceof TypeError;

      if ((isAbort || isNetwork) && attempt < 2) {
        lastError = isAbort
          ? new Error(`Request timed out after ${timeoutMs}ms`)
          : err;
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      if (isAbort) throw new Error(`Request timed out after ${timeoutMs}ms (3 attempts)`);
      throw err;
    }
  }

  throw lastError ?? new Error('fetchWithRetry: all attempts failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
