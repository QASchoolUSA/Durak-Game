import React, { useCallback, useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import type { SeatIndication, SeatRole } from "../game/selectors";
import {
  PlayerAvatar,
  indicationColor,
  indicationShadowColor,
} from "./playerSeatShared";
import { SeatReactionBurst } from "./SeatReactionBurst";
import { TurnTimerRing } from "./TurnTimerRing";
import { TakeSpeechBubble } from "./TakeSpeechBubble";
import { useCardTheme } from "../theme/CardThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";
import { radius, cardSize } from "../theme";

export type { SeatRole };

const RING_FALLBACK = { width: 100, height: 72 };

export interface PlayerSeatProps {
  playerId: string;
  name: string;
  cardCount: number;
  role: SeatRole;
  indication: SeatIndication | null;
  active: boolean;
  onClock: boolean;
  turnProgressSV: SharedValue<number>;
  timerEnabled?: boolean;
  finished?: boolean;
}

const SPRING = { damping: 16, stiffness: 280, mass: 0.7 };

function MiniFan({ count }: { count: number }) {
  const theme = useCardTheme();
  const shown = Math.min(count, 6);
  const cardW = Math.round(cardSize.small.w * 0.52);
  const cardH = Math.round(cardSize.small.h * 0.52);
  const stride = 8;
  return (
    <View style={{ width: (shown - 1) * stride + cardW, height: cardH }}>
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
    </View>
  );
}

function PlayerSeatComponent({
  playerId,
  name,
  cardCount,
  role,
  indication,
  active,
  onClock,
  turnProgressSV,
  timerEnabled = true,
  finished,
}: PlayerSeatProps) {
  const isTaking = role === "taking";
  const expanded = (active || isTaking) && !finished;
  const ui = useUiTheme();
  const showBorder =
    !finished && indication != null && (onClock || role === "taking");
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

  const scale = useSharedValue(expanded ? 1 : 0.94);
  const seatOpacity = useSharedValue(expanded ? 1 : 0.88);

  useEffect(() => {
    scale.value = withSpring(expanded ? 1 : 0.94, SPRING);
    seatOpacity.value = withSpring(expanded ? 1 : 0.88, SPRING);
  }, [expanded, scale, seatOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: seatOpacity.value,
  }));

  const avatarSize = expanded ? 26 : 28;

  const avatarEl = (
    <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
      <PlayerAvatar name={name} size={avatarSize} />
    </View>
  );

  return (
    <View style={styles.outer}>
      <Animated.View style={animStyle}>
        <View style={styles.shell} onLayout={onLayout}>
          <SeatReactionBurst playerId={playerId} />
          {isTaking && !finished && <TakeSpeechBubble />}
          <Animated.View
            entering={FadeIn.duration(350)}
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

            <View style={[styles.body, expanded ? styles.bodyExpanded : styles.bodyCompact]}>
              {expanded ? (
                <View style={styles.topRow}>
                  {avatarEl}
                  <Text
                    style={[styles.name, styles.nameExpanded, styles.nameSingleLine, { color: ui.textPrimary }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              ) : (
                <View style={styles.compactHeader}>
                  {avatarEl}
                  <Text
                    style={[styles.name, styles.nameCompact, styles.nameSingleLine, { color: ui.textPrimary }]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                </View>
              )}

              <View style={styles.cardsRow}>
                {expanded ? (
                  <>
                    <MiniFan count={cardCount} />
                    <Text style={[styles.cardCount, { color: ui.textPrimary }]}>{cardCount}</Text>
                  </>
                ) : (
                  <Text style={[styles.cardCountCompact, { color: ui.textPrimary }]}>
                    {cardCount} cards
                  </Text>
                )}
              </View>
            </View>

            {finished && (
              <View style={styles.roleBarFinished}>
                <Text style={[styles.roleTextFinished, { color: ui.textFaint }]}>FINISHED</Text>
              </View>
            )}
          </Animated.View>
          {showBorder && timerEnabled && (
            <TurnTimerRing
              visible={showBorder}
              color={ringColor}
              maxBorderRadius={radius.panel}
              progressSV={turnProgressSV}
              clockActive={onClock}
              width={ringWidth}
              height={ringHeight}
            />
          )}
        </View>
      </Animated.View>
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
  active: {
    shadowOpacity: 0.70,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  panelTaking: {
    overflow: "visible",
  },
  activeTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  finished: { opacity: 0.45 },

  body: {
    gap: 6,
  },
  bodyExpanded: {
    padding: 8,
  },
  bodyCompact: {
    padding: 7,
    gap: 5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  compactHeader: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
  },
  avatarWrap: {
    position: "relative",
    flexShrink: 0,
    overflow: "visible",
  },
  name: {
    fontWeight: "700",
  },
  nameSingleLine: {
    flexShrink: 0,
  },
  nameExpanded: {
    fontSize: 11,
  },
  nameCompact: {
    fontSize: 11,
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
  cardCountCompact: {
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
