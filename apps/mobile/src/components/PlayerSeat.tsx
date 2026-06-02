import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, radius, cardSize, shadows } from "../theme";

export type SeatRole = "attacker" | "defender" | null;

export interface PlayerSeatProps {
  name:      string;
  cardCount: number;
  role:      SeatRole;
  active:    boolean;
  finished?: boolean;
}

const AVATAR_PALETTE = ["#C44536", "#2D7EA6", "#7B5EA6", "#2E8F6B", "#A0722A", "#4A8A9B"];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

function MiniFan({ count }: { count: number }) {
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
              transform: [{ rotate: `${(i - (shown - 1) / 2) * 7}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function PlayerSeatComponent({ name, cardCount, role, active, finished }: PlayerSeatProps) {
  const isAttacker = role === "attacker";
  const isDefender = role === "defender";

  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={[
        styles.container,
        active && styles.active,
        finished && styles.finished,
      ]}
    >
      {/* Gold inner tint when active */}
      {active && <View style={styles.activeTint} pointerEvents="none" />}

      {/* ── Main body ── */}
      <View style={styles.body}>
        {/* Avatar + name row */}
        <View style={styles.topRow}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(name) }]}>
            <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
        </View>

        {/* Mini card fan + count */}
        <View style={styles.cardsRow}>
          <MiniFan count={cardCount} />
          <Text style={styles.cardCount}>{cardCount}</Text>
        </View>
      </View>

      {/* ── Role bar — full-width stripe at bottom ── */}
      {(isAttacker || isDefender) && !finished && (
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 150,
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
  activeTint: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(231, 192, 103, 0.05)",
    zIndex: 0,
  },
  finished: { opacity: 0.45 },

  body: {
    padding: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  name: {
    color: colors.textLight,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
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
    backgroundColor: colors.cardBack,
    borderWidth: 1,
    borderColor: colors.cardBackAccent,
  },
  cardCount: {
    color: colors.textLight,
    fontSize: 13,
    fontWeight: "800",
  },

  // ── Role bar ──────────────────────────────────────────────────────────────
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
  roleTextAttack:   { color: "#FFCED0" },
  roleTextDefend:   { color: "#FFE9A0" },
  roleTextFinished: { color: colors.textFaint, fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
});

export const PlayerSeat = React.memo(PlayerSeatComponent);
