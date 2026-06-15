import { usePreferencesStore } from "../game/preferencesStore";
import { useGameStore } from "../game/store";
import { convexEnabled } from "../game/convexClient";
import { useHealthCheck } from "./useHealthCheck";

export function useBootReadiness() {
  const appearanceLoaded = usePreferencesStore((s) => s.appearanceLoaded);
  const onboardedHydrated = useGameStore((s) => s.onboardedHydrated);
  const { status: healthStatus, retry: retryHealth } = useHealthCheck();

  const healthBlocking =
    convexEnabled && healthStatus !== "ok" && healthStatus !== "checking";

  const ready =
    appearanceLoaded &&
    onboardedHydrated &&
    (!convexEnabled || healthStatus === "ok");

  return {
    ready,
    loading: !ready && !healthBlocking,
    failed: healthStatus === "failed",
    outdated: healthStatus === "outdated",
    retryHealth,
  };
}
