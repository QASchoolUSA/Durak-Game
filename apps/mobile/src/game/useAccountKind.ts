import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { resolveAccountKind, type AccountKindOverride } from "./accountKind";

export function useAccountKind() {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(
    api.account.getAccountStatus,
    isAuthenticated ? {} : "skip",
  );
  const [override, setOverride] = useState<AccountKindOverride>(null);

  // Clear optimistic override once server state matches.
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

  return {
    isGuest,
    email,
    isLoading,
    status,
    markRegistered,
    markGuest,
  };
}
