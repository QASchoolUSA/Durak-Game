import { useCallback, useEffect, useRef, useState } from "react";
import { convex, convexEnabled } from "../game/convexClient";
import { api } from "../../convex/_generated/api";

/**
 * Client version — bump when the backend raises `minClientVersion` to require
 * a new client build.  Must be >= the server's `minClientVersion` to pass.
 */
export const APP_VERSION = 1;

export type HealthStatus = "checking" | "ok" | "outdated" | "failed";

const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1_000, 2_000];

/**
 * Runs a backend health check with timeout & retry logic.
 *
 * - If Convex is disabled (`convexEnabled === false`), returns `"ok"` immediately.
 * - Calls `health.ping` via the Convex client with a timeout guard.
 * - If the server responds with `minClientVersion` > `APP_VERSION`, returns `"outdated"`.
 * - Retries up to `MAX_RETRIES` times with exponential backoff.
 * - Returns `"failed"` after all retries are exhausted.
 */
export function useHealthCheck(): {
  status: HealthStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<HealthStatus>(
    convexEnabled ? "checking" : "ok",
  );
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const runCheck = useCallback(async () => {
    if (!convex || !convexEnabled) {
      setStatus("ok");
      return;
    }

    setStatus("checking");
    attemptRef.current = 0;

    const attempt = async (): Promise<void> => {
      if (!mountedRef.current) return;

      try {
        const result = await Promise.race([
          convex!.query(api.health.ping, {}),
          new Promise<never>((_, reject) => {
            timeoutRef.current = setTimeout(
              () => reject(new Error("Health check timed out")),
              TIMEOUT_MS,
            );
          }),
        ]);

        cleanup();

        if (!mountedRef.current) return;

        if (result.minClientVersion > APP_VERSION) {
          setStatus("outdated");
          return;
        }

        setStatus("ok");
      } catch {
        cleanup();
        if (!mountedRef.current) return;

        if (attemptRef.current < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attemptRef.current] ?? 2_000;
          attemptRef.current += 1;

          timeoutRef.current = setTimeout(() => {
            void attempt();
          }, delay);
        } else {
          setStatus("failed");
        }
      }
    };

    void attempt();
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    void runCheck();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [runCheck, cleanup]);

  const retry = useCallback(() => {
    cleanup();
    void runCheck();
  }, [runCheck, cleanup]);

  return { status, retry };
}
