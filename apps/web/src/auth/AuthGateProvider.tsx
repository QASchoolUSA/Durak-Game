import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

type AuthGateContextValue = {
  authReady: boolean;
  authLoading: boolean;
  ensureAuthenticated: () => Promise<void>;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

const MAX_AUTO_SIGN_IN_ATTEMPTS = 4;
const AUTO_SIGN_IN_DELAYS_MS = [0, 2_000, 5_000, 10_000];

const DEV = import.meta.env.DEV;

/**
 * Single launch bootstrap for Convex Auth (anonymous).
 * Only this provider auto-signs-in; consumers use useOnlineAuth().
 *
 * Ported from apps/mobile/src/game/useAuthBootstrap.tsx.
 */
export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [signingIn, setSigningIn] = useState(false);
  const signInFlightRef = useRef<Promise<boolean> | null>(null);
  const storageCheckedRef = useRef(false);
  /** True once this session has ever been authenticated (incl. restored token). */
  const hadAuthenticatedSessionRef = useRef(false);
  const autoSignInAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const runSignIn = useCallback((): Promise<boolean> => {
    if (signInFlightRef.current) return signInFlightRef.current;

    setSigningIn(true);
    const flight = signIn("anonymous")
      .then(() => true)
      .catch((err) => {
        console.warn("[auth] anonymous sign-in failed", err);
        return false;
      })
      .finally(() => {
        setSigningIn(false);
        signInFlightRef.current = null;
      });

    signInFlightRef.current = flight;
    return flight;
  }, [signIn]);

  const scheduleAutoSignIn = useCallback(() => {
    if (hadAuthenticatedSessionRef.current) return;
    if (signInFlightRef.current) return;
    if (autoSignInAttemptsRef.current >= MAX_AUTO_SIGN_IN_ATTEMPTS) return;

    const attempt = autoSignInAttemptsRef.current;
    autoSignInAttemptsRef.current += 1;
    const delay = AUTO_SIGN_IN_DELAYS_MS[attempt] ?? 10_000;

    clearRetryTimer();
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      void runSignIn().then((ok) => {
        if (!ok && !hadAuthenticatedSessionRef.current) {
          scheduleAutoSignIn();
        }
      });
    }, delay);
  }, [clearRetryTimer, runSignIn]);

  useEffect(() => {
    if (isLoading) return;

    if (!storageCheckedRef.current) {
      storageCheckedRef.current = true;
      if (DEV) {
        console.debug(
          `[auth] session ${isAuthenticated ? "restored from storage" : "missing — signing in anonymously"}`,
        );
      }
    }

    if (isAuthenticated) {
      hadAuthenticatedSessionRef.current = true;
      autoSignInAttemptsRef.current = 0;
      clearRetryTimer();
      return;
    }

    // WebSocket reconnect can briefly clear auth; don't hammer signIn if we
    // already had a valid session this launch.
    if (hadAuthenticatedSessionRef.current) return;
    if (signInFlightRef.current || retryTimerRef.current) return;

    scheduleAutoSignIn();
  }, [isLoading, isAuthenticated, clearRetryTimer, scheduleAutoSignIn]);

  useEffect(() => () => clearRetryTimer(), [clearRetryTimer]);

  const ensureAuthenticated = useCallback(async () => {
    if (isAuthenticated) return;
    const ok = await runSignIn();
    if (!ok && !hadAuthenticatedSessionRef.current) {
      scheduleAutoSignIn();
    }
  }, [isAuthenticated, runSignIn, scheduleAutoSignIn]);

  const authReady = !isLoading && isAuthenticated;
  const authLoading = isLoading || signingIn;

  return (
    <AuthGateContext.Provider value={{ authReady, authLoading, ensureAuthenticated }}>
      {children}
    </AuthGateContext.Provider>
  );
}

/** Read auth status and await sign-in before online mutations (no auto sign-in on mount). */
export function useOnlineAuth(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    // Convex disabled / provider absent: degrade gracefully so solo play works.
    return {
      authReady: false,
      authLoading: false,
      ensureAuthenticated: async () => {},
    };
  }
  return ctx;
}
