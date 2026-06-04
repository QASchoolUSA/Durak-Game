import { Platform } from "react-native";
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from "expo-haptics";
import { usePreferencesStore } from "../game/preferencesStore";
import { playSound } from "./sounds";

export type HapticEvent =
  | "uiTap"
  | "selection"
  | "confirm"
  | "gameStart"
  | "cardPlay"
  | "takeCards"
  | "roundClear"
  | "deal"
  | "turnStart"
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
    case "roundClear":
    case "turnStart":
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

/** Fire haptic and sound feedback if enabled and supported on this platform. */
export function trigger(event: HapticEvent): void {
  playSound(event);
  if (Platform.OS === "web") return;
  if (!usePreferencesStore.getState().hapticsEnabled) return;

  void playEvent(event).catch(() => {
    // Native module missing or haptics unavailable — ignore.
  });
}
