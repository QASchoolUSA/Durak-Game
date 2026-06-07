import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SeatIndication, SeatRole } from "../game/selectors";
import {
  PlayerAvatar,
  indicationColor,
  indicationShadowColor,
} from "./playerSeatShared";
import { TakeSpeechBubble } from "./TakeSpeechBubble";
import { SeatReactionBurst } from "./SeatReactionBurst";
import { TurnTimerRing } from "./TurnTimerRing";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, typography } from "../theme";

const SPRING = { damping: 16, stiffness: 280, mass: 0.7 };

const RING_FALLBACK = { width: 120, height: 38 };

export interface HumanPlayerChipProps {
  playerId: string;
  name: string;
  role: SeatRole;
  indication: SeatIndication | null;
  onClock: boolean;
  turnProgress: number;
  timerEnabled?: boolean;
  showTimerRing?: boolean;
  /** When false, ring stays full (clock paused e.g. reveal overlay). */
  timerRunning?: boolean;
  finished?: boolean;
  onPress?: () => void;
  showYouLabel?: boolean;
}

function HumanPlayerChipComponent({
  playerId,
  name,
  role,
  indication,
  onClock,
  turnProgress,
  timerEnabled = true,
  showTimerRing = true,
  timerRunning = true,
  finished,
  onPress,
  showYouLabel = false,
}: HumanPlayerChipProps) {
  const ui = useUiTheme();
  const isTaking = role === "taking";
  const showBorder =
    !finished && indication != null && (onClock || isTaking);
  const ringColor = indication ? indicationColor(indication) : ui.accent;
  const glowColor = indication ? indicationShadowColor(indication) : ui.accent;

  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
  const layoutReady = layoutSize.width > 0 && layoutSize.height > 0;
  const ringWidth = layoutReady ? layoutSize.width : RING_FALLBACK.width;
  const ringHeight = layoutReady ? layoutSize.height : RING_FALLBACK.height;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayoutSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);

  const scale = useSharedValue(showBorder ? 1 : 0.96);
  const opacity = useSharedValue(showBorder ? 1 : 0.9);

  useEffect(() => {
    scale.value = withSpring(showBorder ? 1 : 0.96, SPRING);
    opacity.value = withSpring(showBorder ? 1 : 0.9, SPRING);
  }, [showBorder, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.frame, animStyle]}>
      <View style={styles.shell} onLayout={onLayout}>
        <SeatReactionBurst playerId={playerId} />
        {isTaking && !finished && <TakeSpeechBubble />}
        <View
          style={[
            styles.panel,
            { backgroundColor: ui.panelBg },
            showBorder && [styles.active, { shadowColor: glowColor }],
            isTaking && !finished && styles.panelTaking,
            finished && styles.finished,
          ]}
        >
          {showBorder && (
            <View style={[styles.activeTint, { backgroundColor: ui.activeTint }]} pointerEvents="none" />
          )}
          <Pressable
            style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open reactions"
          >
            <PlayerAvatar name={name} size={28} />
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, { color: ui.textPrimary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              {showYouLabel && (
                <Text style={[styles.youLabel, { color: ui.accentMuted }]}>
                  (you)
                </Text>
              )}
            </View>
          </Pressable>
        </View>
        {onClock && timerEnabled && showTimerRing && (
          <TurnTimerRing
            visible
            color={ringColor}
            maxBorderRadius={radius.panel}
            progress={turnProgress}
            clockActive={timerRunning}
            width={ringWidth}
            height={ringHeight}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "center",
    overflow: "visible",
  },
  shell: {
    position: "relative",
    alignSelf: "center",
    overflow: "visible",
  },
  panel: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.panel,
    overflow: "hidden",
  },
  panelTaking: {
    overflow: "visible",
  },
  active: {
    shadowOpacity: 0.65,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  activeTint: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  finished: { opacity: 0.45 },
  pressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 1,
  },
  pressablePressed: { opacity: 0.85 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: 140,
  },
  name: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  youLabel: {
    ...typography.caption,
    flexShrink: 0,
  },
});

export const HumanPlayerChip = React.memo(HumanPlayerChipComponent);
