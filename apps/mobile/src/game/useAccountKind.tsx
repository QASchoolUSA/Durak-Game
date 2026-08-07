import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { convexEnabled } from "./convexClient";
import { resolveAccountKind, type AccountKindOverride } from "./accountKind";

type AccountKindContextValue = {
  isGuest: boolean;
  email: string | null;
  handle: string | null;
  isLoading: boolean;
  status: { isAnonymous: boolean; email: string | null } | null | undefined;
  markRegistered: () => void;
  markGuest: () => void;
};

const AccountKindContext = createContext<AccountKindContextValue | null>(null);

const GUEST_FALLBACK: AccountKindContextValue = {
  isGuest: true,
  email: null,
  handle: null,
  isLoading: false,
  status: undefined,
  markRegistered: () => {},
  markGuest: () => {},
};

function AccountKindProviderInner({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(
    api.account.getAccountStatus,
    isAuthenticated ? {} : "skip",
  );
  const profile = useQuery(
    api.profiles.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const [override, setOverride] = useState<AccountKindOverride>(null);

  useEffect(() => {
    if (!status || override === null) return;
    if (override === "registered" && !status.isAnonymous) {
      setOverride(null);
    }
    if (override === "guest" && status.isAnonymous) {
      setOverride(null);
    }
  }, [status, override]);

  const { isGuest, email } = resolveAccountKind(status, override);

  const markRegistered = useCallback(() => setOverride("registered"), []);
  const markGuest = useCallback(() => setOverride("guest"), []);

  const isLoading = isAuthenticated && status === undefined;
  const handle =
    !isGuest && profile && typeof profile.handle === "string"
      ? profile.handle
      : null;

  const value = useMemo(
    () => ({
      isGuest,
      email,
      handle,
      isLoading,
      status,
      markRegistered,
      markGuest,
    }),
    [isGuest, email, handle, isLoading, status, markRegistered, markGuest],
  );

  return (
    <AccountKindContext.Provider value={value}>
      {children}
    </AccountKindContext.Provider>
  );
}

/**
 * Shared guest vs registered state for the whole app (Home FRIENDS, Settings,
 * Lobby invite, push). Optimistic markRegistered/markGuest is visible everywhere.
 */
export function AccountKindProvider({ children }: { children: ReactNode }) {
  if (!convexEnabled) {
    return (
      <AccountKindContext.Provider value={GUEST_FALLBACK}>
        {children}
      </AccountKindContext.Provider>
    );
  }
  return <AccountKindProviderInner>{children}</AccountKindProviderInner>;
}

export function useAccountKind(): AccountKindContextValue {
  const ctx = useContext(AccountKindContext);
  if (!ctx) {
    throw new Error("useAccountKind must be used within AccountKindProvider");
  }
  return ctx;
}
