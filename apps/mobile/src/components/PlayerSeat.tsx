import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import type { SeatIndication, SeatRole } from "../game/selectors";
import { PlayerAvatar, indicationColor } from "./playerSeatShared";
import { SeatReactionBurst } from "./SeatReactionBurst";
import { TurnTimerRing } from "./TurnTimerRing";
import { TakeSpeechBubble } from "./TakeSpeechBubble";
import { useCardTheme } from "../theme/CardThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { MeasuredAnchor, type AnchorRect } from "./MeasuredAnchor";
import { radius, cardSize } from "../theme";

export type { SeatRole };

const RING_FALLBACK = { width: 100, height: 72 };

export interface PlayerSeatProps {
  playerId: string;
  name: string;
  cardCount: number;
  role: SeatRole;
  indication: SeatIndication | null;
  onClock: boolean;
  turnProgress: number;
  timerEnabled?: boolean;
  showTimerRing?: boolean;
  finished?: boolean;
  skipEnterAnimation?: boolean;
  landingPulseToken?: number;
  onSeatAnchorLayout?: (anchorId: string, rect: AnchorRect) => void;
  onSeatAnchorRemoved?: (anchorId: string) => void;
}

export function seatAnchorId(playerId: string): string {
  return `seat-${playerId}`;
}

const SPRING = { damping: 16, stiffness: 280, mass: 0.7 };

function MiniFan({ count, pulseToken = 0 }: { count: number; pulseToken?: number }) {
  const theme = useCardTheme();
  const shown = Math.min(count, 6);
  const cardW = Math.round(cardSize.small.w * 0.52);
  const cardH = Math.round(cardSize.small.h * 0.52);
  const stride = 8;
  const fanScale = useSharedValue(1);

  useEffect(() => {
    if (pulseToken <= 0) return;
    fanScale.value = withSequence(
      withSpring(1.08, { damping: 12, stiffness: 420, mass: 0.5 }),
      withSpring(1, SPRING),
    );
  }, [pulseToken, fanScale]);

  const fanStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fanScale.value }],
  }));

  if (shown === 0) {
    return <View style={{ width: cardW, height: cardH }} />;
  }

  return (
    <Animated.View style={[{ width: (shown - 1) * stride + cardW, height: cardH }, fanStyle]}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.miniCard,
            {
              width: cardW,
              height: cardH,
              left: i * stride,
              backgroundColor: theme.back,
              borderColor: theme.backAccent,
              transform: [{ rotate: `${(i - (shown - 1) / 2) * 7}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function PlayerSeatComponent({
  playerId,
  name,
  cardCount,
  role,
  indication,
  onClock,
  turnProgress,
  timerEnabled = true,
  showTimerRing = true,
  finished,
  skipEnterAnimation = false,
  landingPulseToken = 0,
  onSeatAnchorLayout,
  onSeatAnchorRemoved,
}: PlayerSeatProps) {
  const isTaking = role === "taking";
  const ui = useUiTheme();
  const showTimer =
    !finished && indication != null && (onClock || role === "taking");
  const ringColor = indication ? indicationColor(indication) : ui.accent;

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
    <View style={styles.outer}>
      <View style={styles.shell} onLayout={onLayout}>
        <SeatReactionBurst playerId={playerId} />
        {isTaking && !finished && <TakeSpeechBubble />}
        <Animated.View
          entering={skipEnterAnimation ? undefined : FadeIn.duration(350)}
          style={[
            styles.panel,
            { backgroundColor: ui.panelBg },
            isTaking && !finished && styles.panelTaking,
            finished && styles.finished,
          ]}
        >
          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={styles.avatarWrap}>
                <PlayerAvatar name={name} size={28} />
              </View>
              <Text
                style={[styles.name, styles.nameSingleLine, { color: ui.textPrimary }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>

            <View style={styles.cardsRow}>
              <MeasuredAnchor
                anchorId={seatAnchorId(playerId)}
                onAnchorLayout={onSeatAnchorLayout}
                onAnchorRemoved={onSeatAnchorRemoved}
              >
                <MiniFan count={cardCount} pulseToken={landingPulseToken} />
              </MeasuredAnchor>
              <Text style={[styles.cardCount, { color: ui.textPrimary }]}>{cardCount}</Text>
            </View>
          </View>

          {finished && (
            <View style={styles.roleBarFinished}>
              <Text style={[styles.roleTextFinished, { color: ui.textFaint }]}>FINISHED</Text>
            </View>
          )}
        </Animated.View>
        {showTimer && timerEnabled && showTimerRing && (
          <TurnTimerRing
            visible
            color={ringColor}
            maxBorderRadius={radius.panel}
            progress={turnProgress}
            clockActive={onClock}
            width={ringWidth}
            height={ringHeight}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    maxWidth: 148,
    alignSelf: "flex-start",
    overflow: "visible",
  },
  shell: {
    position: "relative",
    alignSelf: "flex-start",
    overflow: "visible",
  },
  panel: {
    alignSelf: "flex-start",
    minWidth: 100,
    borderRadius: radius.panel,
    overflow: "hidden",
  },
  panelTaking: {
    overflow: "visible",
  },
  finished: { opacity: 0.45 },

  body: {
    gap: 6,
    padding: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
    overflow: "visible",
  },
  name: {
    fontWeight: "700",
    fontSize: 11,
  },
  nameSingleLine: {
    flexShrink: 0,
  },
  cardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  miniCard: {
    position: "absolute",
    top: 0,
    borderRadius: 4,
    borderWidth: 1,
  },
  cardCount: {
    fontSize: 11,
    fontWeight: "800",
  },
  roleBarFinished: {
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  roleTextFinished: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
});

export const PlayerSeat = React.memo(PlayerSeatComponent);
