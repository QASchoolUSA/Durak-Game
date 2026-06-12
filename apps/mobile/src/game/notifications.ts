import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerConfigured = false;

/** Show invite/friend notifications as a banner while the app is foregrounded. */
export function configureNotificationHandler(): void {
  if (handlerConfigured || Platform.OS === "web") return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Subscribe to notification taps. Returns an unsubscribe fn. The reactive
 * `incomingInvites` query already surfaces the invite banner once the app is
 * foregrounded, so here we only need to make sure the app comes to front; the
 * `onInviteTap` callback is a hook for any extra routing.
 */
export function addNotificationResponseListener(
  onInviteTap: (data: Record<string, unknown>) => void,
): () => void {
  if (Platform.OS === "web") return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<
      string,
      unknown
    >;
    onInviteTap(data);
  });
  return () => sub.remove();
}
