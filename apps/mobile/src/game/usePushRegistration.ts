import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Expo Go can't deliver remote push (no APNs entitlement); only register in a
// dev/standalone build.
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  addNotificationResponseListener,
  configureNotificationHandler,
} from "./notifications";

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId
  );
}

/**
 * Registers this device's Expo push token with Convex once the user is
 * authenticated, and wires up the foreground notification handler + tap
 * listener. Mounted inside the authenticated layer in App.tsx.
 */
export function usePushRegistration(): void {
  const { isAuthenticated } = useConvexAuth();
  const registerPushToken = useMutation(api.push.registerPushToken);
  const registeredRef = useRef(false);

  useEffect(() => {
    configureNotificationHandler();
    const unsub = addNotificationResponseListener(() => {
      // Bringing the app to the foreground is enough; the reactive
      // incomingInvites query renders the in-app banner.
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return;
    if (Platform.OS === "web" || !Device.isDevice || isExpoGo) return;

    let cancelled = false;
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted" || cancelled) return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const projectId = getProjectId();
        const tokenResponse = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;

        await registerPushToken({
          token: tokenResponse.data,
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
        registeredRef.current = true;
      } catch (err) {
        if (__DEV__) console.warn("[push] registration failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, registerPushToken]);
}
