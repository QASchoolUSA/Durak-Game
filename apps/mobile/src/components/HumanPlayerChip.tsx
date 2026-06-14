import React, { useCallback, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import type { SeatIndication, SeatRole } from "../game/selectors";
import { seatRoleTag } from "../game/selectors";
import type { TurnClockConfig } from "../game/turnClockEngine";
import { PlayerAvatar, indicationColor } from "./playerSeatShared";
import { TakeSpeechBubble } from "./TakeSpeechBubble";
import { SeatReactionBurst } from "./SeatReactionBurst";
import { SeatTurnTimerRing } from "./SeatTurnTimerRing";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, typography } from "../theme";

const RING_FALLBACK = { width: 120, height: 38 };

export interface HumanPlayerChipProps {
  playerId: string;
  name: string;
  role: SeatRole;
  indication: SeatIndication | null;
  onClock: boolean;
  clockConfig: TurnClockConfig;
  timerEnabled?: boolean;
  showTimerRing?: boolean;
  /** When false, ring stays full (clock paused e.g. reveal overlay). */
  timerRunning?: boolean;
  dimmed?: boolean;
  finished?: boolean;
  onPress?: () => void;
}

function HumanPlayerChipComponent({
  playerId,
  name,
  role,
  indication,
  onClock,
  clockConfig,
  timerEnabled = true,
  showTimerRing = true,
  timerRunning = true,
  dimmed = false,
  finished,
  onPress,
}: HumanPlayerChipProps) {
  const ui = useUiTheme();
  const isTaking = role === "taking";
  const ringColor = indication ? indicationColor(indication) : ui.accent;
  const tag = !finished ? seatRoleTag(role) : null;
  const tagColor = tag ? indicationColor(tag.indication) : ui.accent;

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

  return (
    <View style={styles.frame}>
      <View style={styles.shell}>
        <SeatReactionBurst playerId={playerId} />
        {isTaking && !finished && <TakeSpeechBubble />}
        <View style={styles.wrapper}>
          <View
            onLayout={onLayout}
            style={[
              styles.panel,
              { backgroundColor: ui.panelBg },
              isTaking && !finished && styles.panelTaking,
              dimmed && !finished && styles.dimmed,
              finished && styles.finished,
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
              onPress={onPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open reactions"
            >
              <PlayerAvatar name={name} size={28} />
              <Text
                style={[styles.name, { color: ui.textPrimary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </Pressable>
            {tag && (
              <View style={[styles.roleBar, { backgroundColor: `${tagColor}22` }]}>
                <Text style={[styles.roleText, { color: tagColor }]}>
                  {tag.label}
                </Text>
              </View>
            )}
          </View>
        </View>
        {onClock && timerEnabled && showTimerRing && (
          <SeatTurnTimerRing
            visible
            color={ringColor}
            maxBorderRadius={radius.panel}
            clockConfig={clockConfig}
            clockActive={timerRunning}
            width={ringWidth}
            height={ringHeight}
          />
        )}
      </View>
    </View>
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
  wrapper: {
    height: 38,
    alignSelf: "center",
    overflow: "visible",
  },
  panel: {
    borderRadius: radius.panel,
    overflow: "hidden",
    minWidth: 100,
  },
  panelTaking: {
    overflow: "visible",
  },
  finished: { opacity: 0.45 },
  dimmed: { opacity: 0.5 },
  pressable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 1,
  },
  pressablePressed: { opacity: 0.85 },
  name: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  roleBar: {
    paddingVertical: 3,
    alignItems: "center",
  },
  roleText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

export const HumanPlayerChip = React.memo(HumanPlayerChipComponent);
