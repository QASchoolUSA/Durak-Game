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

/**
 * Single launch bootstrap for Convex Auth (anonymous).
 * Only this provider auto-signs-in; consumers use useOnlineAuth().
 */
export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [signingIn, setSigningIn] = useState(false);
  const signInFlightRef = useRef<Promise<unknown> | null>(null);
  const storageCheckedRef = useRef(false);

  const runSignIn = useCallback(() => {
    if (signInFlightRef.current) return signInFlightRef.current;
    setSigningIn(true);
    const flight = signIn("anonymous")
      .catch((err) => {
        console.warn("[auth] anonymous sign-in failed", err);
        throw err;
      })
      .finally(() => {
        setSigningIn(false);
        signInFlightRef.current = null;
      });
    signInFlightRef.current = flight;
    return flight;
  }, [signIn]);

  useEffect(() => {
    if (isLoading) return;

    if (!storageCheckedRef.current) {
      storageCheckedRef.current = true;
      if (__DEV__) {
        console.debug(
          `[auth] session ${isAuthenticated ? "restored from storage" : "missing — signing in anonymously"}`,
        );
      }
    }

    if (isAuthenticated) return;
    void runSignIn();
  }, [isLoading, isAuthenticated, runSignIn]);

  const ensureAuthenticated = useCallback(async () => {
    if (isAuthenticated) return;
    await runSignIn();
  }, [isAuthenticated, runSignIn]);

  const authReady = !isLoading && isAuthenticated;
  const authLoading = isLoading || signingIn;

  return (
    <AuthGateContext.Provider
      value={{ authReady, authLoading, ensureAuthenticated }}
    >
      {children}
    </AuthGateContext.Provider>
  );
}

/** Read auth status and await sign-in before online mutations (no auto sign-in on mount). */
export function useOnlineAuth(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error("useOnlineAuth must be used within AuthGateProvider");
  }
  return ctx;
}

/** @deprecated Use useOnlineAuth — kept for legacy call sites. */
export function useAuthBootstrap(): { authReady: boolean } {
  const { authReady } = useOnlineAuth();
  return { authReady };
}
