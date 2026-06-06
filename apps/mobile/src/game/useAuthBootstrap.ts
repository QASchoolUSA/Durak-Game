import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

/**
 * Ensures Convex Auth (anonymous) is ready before online mutations.
 * AuthBootstrap runs sign-in on launch; callers can await ensureAuthenticated().
 */
export function useConvexAuthGate() {
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

  return { authReady, authLoading, ensureAuthenticated };
}

/** @deprecated Use useConvexAuthGate — kept for AuthBootstrap mount. */
export function useAuthBootstrap(): { authReady: boolean } {
  const { authReady } = useConvexAuthGate();
  return { authReady };
}

export function AuthBootstrap() {
  useConvexAuthGate();
  return null;
}
