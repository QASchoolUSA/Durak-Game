import { Platform } from "react-native";
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from "expo-haptics";
import { usePreferencesStore } from "../game/preferencesStore";

export type HapticEvent =
  | "uiTap"
  | "selection"
  | "confirm"
  | "gameStart"
  | "cardPlay"
  | "takeCards"
  | "timerWarning"
  | "timerCritical"
  | "timerExpired"
  | "success"
  | "failure"
  | "error";

async function playEvent(event: HapticEvent): Promise<void> {
  switch (event) {
    case "uiTap":
    case "timerWarning":
      await impactAsync(ImpactFeedbackStyle.Light);
      break;
    case "selection":
      await selectionAsync();
      break;
    case "confirm":
    case "cardPlay":
    case "timerCritical":
      await impactAsync(ImpactFeedbackStyle.Medium);
      break;
    case "gameStart":
    case "timerExpired":
      await impactAsync(ImpactFeedbackStyle.Heavy);
      break;
    case "takeCards":
      await notificationAsync(NotificationFeedbackType.Warning);
      break;
    case "success":
      await notificationAsync(NotificationFeedbackType.Success);
      break;
    case "failure":
    case "error":
      await notificationAsync(NotificationFeedbackType.Error);
      break;
  }
}

/** Fire a haptic event if enabled and supported on this platform. */
export function trigger(event: HapticEvent): void {
  if (Platform.OS === "web") return;
  if (!usePreferencesStore.getState().hapticsEnabled) return;

  void playEvent(event).catch(() => {
    // Native module missing or haptics unavailable — ignore.
  });
}
