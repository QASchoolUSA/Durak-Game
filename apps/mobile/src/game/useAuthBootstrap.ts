import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";

export function useAuthBootstrap(): { authReady: boolean } {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const signingInRef = useRef(false);

  useEffect(() => {
    if (isLoading || isAuthenticated || signingInRef.current) return;
    signingInRef.current = true;
    void signIn("anonymous").finally(() => {
      signingInRef.current = false;
    });
  }, [isLoading, isAuthenticated, signIn]);

  return { authReady: !isLoading && isAuthenticated };
}

export function AuthBootstrap() {
  useAuthBootstrap();
  return null;
}
