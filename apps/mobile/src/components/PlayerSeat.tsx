import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { SeatRole } from "../game/selectors";
import { TakeSpeechBubble } from "./TakeSpeechBubble";
import { useCardTheme } from "../theme/CardThemeContext";
import { colors, radius, cardSize, shadows } from "../theme";

export type { SeatRole };

export interface PlayerSeatProps {
  name:      string;
  cardCount: number;
  role:      SeatRole;
  active:    boolean;
  finished?: boolean;
}

const SPRING = { damping: 16, stiffness: 280, mass: 0.7 };

const AVATAR_PALETTE = ["#C44536", "#2D7EA6", "#7B5EA6", "#2E8F6B", "#A0722A", "#4A8A9B"];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function MiniFan({ count }: { count: number }) {
  const theme = useCardTheme();
  const shown = Math.min(count, 6);
  const cardW = Math.round(cardSize.small.w * 0.58);
  const cardH = Math.round(cardSize.small.h * 0.58);
  const stride = 9;
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
  name,
  cardCount,
  role,
  active,
  finished,
}: PlayerSeatProps) {
  const isAttacker = role === "attacker";
  const isDefender = role === "defender";
  const isTaking = role === "taking";
  const expanded = (active || isTaking) && !finished;

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

  const avatarSize = expanded ? 32 : 30;
  const avatarRadius = avatarSize / 2;
  const letterSize = expanded ? 14 : 12;

  const avatarEl = (
    <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
      {isTaking && !finished && <TakeSpeechBubble />}
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarRadius,
            backgroundColor: avatarColor(name),
          },
        ]}
      >
        <Text style={[styles.avatarLetter, { fontSize: letterSize }]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.outer}>
      <Animated.View style={animStyle}>
        <Animated.View
          entering={FadeIn.duration(350)}
          style={[
            styles.container,
            active && expanded && styles.active,
            isTaking && expanded && !active && styles.taking,
            isTaking && !finished && styles.containerTaking,
            finished && styles.finished,
          ]}
        >
          {active && expanded && <View style={styles.activeTint} pointerEvents="none" />}

          <View style={[styles.body, expanded ? styles.bodyExpanded : styles.bodyCompact]}>
            {expanded ? (
              <View style={styles.topRow}>
                {avatarEl}
                <Text
                  style={[styles.name, styles.nameExpanded, styles.nameSingleLine]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </View>
            ) : (
              <View style={styles.compactHeader}>
                {avatarEl}
                <Text
                  style={[styles.name, styles.nameCompact, styles.nameSingleLine]}
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
                  <Text style={styles.cardCount}>{cardCount}</Text>
                </>
              ) : (
                <Text style={styles.cardCountCompact}>{cardCount} cards</Text>
              )}
            </View>
          </View>

          {expanded && (isAttacker || isDefender) && (
            <View
              style={[
                styles.roleBar,
                isAttacker ? styles.roleBarAttack : styles.roleBarDefend,
              ]}
            >
              <Text style={[styles.roleText, isAttacker ? styles.roleTextAttack : styles.roleTextDefend]}>
                {isAttacker ? "ATTACKING" : "DEFENDING"}
              </Text>
            </View>
          )}

          {finished && (
            <View style={styles.roleBarFinished}>
              <Text style={styles.roleTextFinished}>FINISHED</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    maxWidth: 168,
    alignSelf: "flex-start",
    overflow: "visible",
  },
  container: {
    alignSelf: "flex-start",
    minWidth: 112,
    borderRadius: radius.panel,
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: "transparent",
    overflow: "hidden",
  },
  active: {
    borderColor: colors.gold,
    ...shadows.goldGlow,
  },
  taking: {
    borderColor: "rgba(221, 208, 245, 0.45)",
  },
  containerTaking: {
    overflow: "visible",
  },
  activeTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(231, 192, 103, 0.05)",
    zIndex: 0,
  },
  finished: { opacity: 0.45 },

  body: {
    gap: 8,
  },
  bodyExpanded: {
    padding: 10,
  },
  bodyCompact: {
    padding: 8,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
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
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontWeight: "900",
  },
  name: {
    color: colors.textLight,
    fontWeight: "700",
  },
  nameSingleLine: {
    flexShrink: 0,
  },
  nameExpanded: {
    fontSize: 12,
  },
  nameCompact: {
    fontSize: 12,
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
    color: colors.textLight,
    fontSize: 13,
    fontWeight: "800",
  },
  cardCountCompact: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: "800",
  },

  roleBar: {
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  roleBarAttack: {
    backgroundColor: "#9E1E27",
  },
  roleBarDefend: {
    backgroundColor: "#8A6A18",
  },
  roleBarFinished: {
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  roleText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.0,
  },
  roleTextAttack: { color: "#FFCED0" },
  roleTextDefend: { color: "#FFE9A0" },
  roleTextFinished: { color: colors.textFaint, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
});

export const PlayerSeat = React.memo(PlayerSeatComponent);
