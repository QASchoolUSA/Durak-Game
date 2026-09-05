export type AccountStatusSnapshot = {
  isAnonymous: boolean;
  email: string | null;
};

export type WaitForRegisteredAccountOptions = {
  /** Initial poll interval in ms. Default 100. Doubles each wait up to maxIntervalMs. */
  intervalMs?: number;
  /** Cap for exponential backoff in ms. Default 800. */
  maxIntervalMs?: number;
  /** Max wait in ms. Default 15000. */
  timeoutMs?: number;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_INTERVAL_MS = 100;
const DEFAULT_MAX_INTERVAL_MS = 800;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Poll until the server reports a registered (non-anonymous) account, or timeout.
 * Handles Convex auth token propagation lag after password sign-in.
 * Uses exponential backoff so early polls are frequent without hammering forever.
 */
export async function waitForRegisteredAccount(
  fetchStatus: () => Promise<AccountStatusSnapshot | null | undefined>,
  options: WaitForRegisteredAccountOptions = {},
): Promise<AccountStatusSnapshot | null> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxIntervalMs = options.maxIntervalMs ?? DEFAULT_MAX_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const deadline = Date.now() + timeoutMs;
  let last: AccountStatusSnapshot | null = null;
  let delay = intervalMs;

  while (Date.now() < deadline) {
    try {
      const status = await fetchStatus();
      if (status) last = status;
      if (status && !status.isAnonymous) return status;
    } catch {
      /* transient — keep polling */
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(delay, remaining));
    delay = Math.min(delay * 2, maxIntervalMs);
  }

  return last;
}
