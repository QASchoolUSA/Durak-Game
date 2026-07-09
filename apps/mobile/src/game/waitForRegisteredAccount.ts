export type AccountStatusSnapshot = {
  isAnonymous: boolean;
  email: string | null;
};

export type WaitForRegisteredAccountOptions = {
  /** Poll interval in ms. Default 400. */
  intervalMs?: number;
  /** Max wait in ms. Default 4000. */
  timeoutMs?: number;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULT_INTERVAL_MS = 400;
const DEFAULT_TIMEOUT_MS = 4_000;

/**
 * Poll until the server reports a registered (non-anonymous) account, or timeout.
 * Handles Convex auth token propagation lag after password sign-in.
 */
export async function waitForRegisteredAccount(
  fetchStatus: () => Promise<AccountStatusSnapshot | null | undefined>,
  options: WaitForRegisteredAccountOptions = {},
): Promise<AccountStatusSnapshot | null> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const deadline = Date.now() + timeoutMs;
  let last: AccountStatusSnapshot | null = null;

  while (Date.now() < deadline) {
    try {
      const status = await fetchStatus();
      if (status) last = status;
      if (status && !status.isAnonymous) return status;
    } catch {
      /* transient — keep polling */
    }
    await sleep(intervalMs);
  }

  return last;
}
