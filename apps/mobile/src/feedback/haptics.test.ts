import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const impactAsync = vi.fn().mockResolvedValue(undefined);
  const notificationAsync = vi.fn().mockResolvedValue(undefined);
  const selectionAsync = vi.fn().mockResolvedValue(undefined);
  const platformState = { os: "ios" as "ios" | "android" | "web" };
  const preferencesState = { hapticsEnabled: true };

  return { impactAsync, notificationAsync, selectionAsync, platformState, preferencesState };
});

vi.mock("./sounds", () => ({
  playSound: vi.fn(),
}));

vi.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  impactAsync: mocks.impactAsync,
  notificationAsync: mocks.notificationAsync,
  selectionAsync: mocks.selectionAsync,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return mocks.platformState.os;
    },
  },
}));

vi.mock("../game/preferencesStore", () => ({
  usePreferencesStore: {
    getState: () => mocks.preferencesState,
  },
}));

import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";
import { trigger } from "./haptics";

describe("trigger", () => {
  beforeEach(() => {
    mocks.impactAsync.mockClear();
    mocks.notificationAsync.mockClear();
    mocks.selectionAsync.mockClear();
    mocks.platformState.os = "ios";
    mocks.preferencesState.hapticsEnabled = true;
  });

  it("no-ops on web", () => {
    mocks.platformState.os = "web";
    trigger("uiTap");
    expect(mocks.impactAsync).not.toHaveBeenCalled();
    expect(mocks.selectionAsync).not.toHaveBeenCalled();
    expect(mocks.notificationAsync).not.toHaveBeenCalled();
  });

  it("no-ops when haptics disabled", () => {
    mocks.preferencesState.hapticsEnabled = false;
    trigger("cardPlay");
    expect(mocks.impactAsync).not.toHaveBeenCalled();
  });

  it("maps uiTap to light impact", () => {
    trigger("uiTap");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
  });

  it("maps selection to selectionAsync", () => {
    trigger("selection");
    expect(mocks.selectionAsync).toHaveBeenCalled();
  });

  it("maps confirm to medium impact", () => {
    trigger("confirm");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
  });

  it("maps gameStart to heavy impact", () => {
    trigger("gameStart");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Heavy);
  });

  it("maps cardPlay to medium impact", () => {
    trigger("cardPlay");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
  });

  it("maps takeCards to warning notification", () => {
    trigger("takeCards");
    expect(mocks.notificationAsync).toHaveBeenCalledWith(NotificationFeedbackType.Warning);
  });

  it("maps timerWarning to light impact", () => {
    trigger("timerWarning");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Light);
  });

  it("maps timerCritical to medium impact", () => {
    trigger("timerCritical");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Medium);
  });

  it("maps timerExpired to heavy impact", () => {
    trigger("timerExpired");
    expect(mocks.impactAsync).toHaveBeenCalledWith(ImpactFeedbackStyle.Heavy);
  });

  it("maps success to success notification", () => {
    trigger("success");
    expect(mocks.notificationAsync).toHaveBeenCalledWith(NotificationFeedbackType.Success);
  });

  it("maps failure to error notification", () => {
    trigger("failure");
    expect(mocks.notificationAsync).toHaveBeenCalledWith(NotificationFeedbackType.Error);
  });

  it("maps error to error notification", () => {
    trigger("error");
    expect(mocks.notificationAsync).toHaveBeenCalledWith(NotificationFeedbackType.Error);
  });

  it("swallows native module failures", async () => {
    mocks.impactAsync.mockRejectedValueOnce(new Error("unavailable"));
    expect(() => trigger("uiTap")).not.toThrow();
    await Promise.resolve();
  });
});
