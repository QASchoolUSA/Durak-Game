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
  /** Mint/restore an anonymous guest session (Continue as Guest, post sign-out). */
  ensureGuestSession: () => Promise<void>;
  /** Ensure some session exists before online play (guest or registered). */
  ensureAuthenticated: () => Promise<void>;
  /**
   * Call before password sign-in/sign-up so in-flight anonymous auth cannot
   * overwrite the credential session.
   */
  beginCredentialAuth: () => void;
  /** Clear the credential-auth lock after finish (success or failure). */
  endCredentialAuth: () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

/**
 * Auth gate for Convex.
 *
 * - Restored tokens are kept; we do NOT auto-mint anonymous on cold launch
 *   (avoids racing password login on Welcome).
 * - Guests call ensureGuestSession() explicitly.
 * - beginCredentialAuth() suppresses anonymous sign-in until endCredentialAuth().
 */
export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [signingIn, setSigningIn] = useState(false);
  const signInFlightRef = useRef<Promise<boolean> | null>(null);
  const storageCheckedRef = useRef(false);
  /** True once this launch has had a valid session (restored or minted). */
  const hadAuthenticatedSessionRef = useRef(false);
  /**
   * Generation bump: in-flight anonymous completions with a stale generation
   * are treated as cancelled (token may still land — we also block starting
   * new anonymous work while credential auth is active).
   */
  const authGenerationRef = useRef(0);
  const credentialAuthActiveRef = useRef(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  useEffect(() => {
    if (isLoading) return;
    if (!storageCheckedRef.current) {
      storageCheckedRef.current = true;
      if (__DEV__) {
        console.debug(
          `[auth] session ${isAuthenticated ? "restored from storage" : "missing — waiting for guest or credentials"}`,
        );
      }
    }
    if (isAuthenticated) {
      hadAuthenticatedSessionRef.current = true;
    }
  }, [isLoading, isAuthenticated]);

  const runAnonymousSignIn = useCallback((): Promise<boolean> => {
    if (credentialAuthActiveRef.current) {
      if (__DEV__) {
        console.debug("[auth] skip anonymous — credential auth in progress");
      }
      return Promise.resolve(false);
    }
    if (signInFlightRef.current) return signInFlightRef.current;

    const generation = authGenerationRef.current;
    setSigningIn(true);
    const flight = signIn("anonymous")
      .then(() => {
        if (
          credentialAuthActiveRef.current ||
          generation !== authGenerationRef.current
        ) {
          if (__DEV__) {
            console.warn(
              "[auth] discarding late anonymous sign-in (credential auth won)",
            );
          }
          return false;
        }
        return true;
      })
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

  const beginCredentialAuth = useCallback(() => {
    credentialAuthActiveRef.current = true;
    // Invalidate any in-flight anonymous completion.
    authGenerationRef.current += 1;
  }, []);

  const endCredentialAuth = useCallback(() => {
    credentialAuthActiveRef.current = false;
  }, []);

  const ensureGuestSession = useCallback(async () => {
    // Allow guest minting after intentional sign-out.
    hadAuthenticatedSessionRef.current = false;
    credentialAuthActiveRef.current = false;
    authGenerationRef.current += 1;

    // After signOut(), React may still report authenticated for a tick —
    // wait briefly for the token clear before deciding to mint.
    for (let i = 0; i < 25; i++) {
      if (!isAuthenticatedRef.current) break;
      await new Promise((r) => setTimeout(r, 40));
    }

    if (isAuthenticatedRef.current) {
      hadAuthenticatedSessionRef.current = true;
      return;
    }

    const ok = await runAnonymousSignIn();
    if (!ok) {
      throw new Error("Could not start a guest session. Check your connection.");
    }
    hadAuthenticatedSessionRef.current = true;
  }, [runAnonymousSignIn]);

  const ensureAuthenticated = useCallback(async () => {
    if (isAuthenticatedRef.current) return;
    if (credentialAuthActiveRef.current) {
      // Don't mint a guest over an in-progress password login.
      throw new Error("Signing in… try again in a moment.");
    }
    const ok = await runAnonymousSignIn();
    if (!ok && !isAuthenticatedRef.current) {
      throw new Error("Not authenticated");
    }
  }, [runAnonymousSignIn]);

  const authReady = !isLoading && isAuthenticated;
  const authLoading = isLoading || signingIn;

  return (
    <AuthGateContext.Provider
      value={{
        authReady,
        authLoading,
        ensureGuestSession,
        ensureAuthenticated,
        beginCredentialAuth,
        endCredentialAuth,
      }}
    >
      {children}
    </AuthGateContext.Provider>
  );
}

/** Read auth status and await sign-in before online mutations. */
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
