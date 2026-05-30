import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { colors, radius, cardSize } from "../theme";

export type SeatRole = "attacker" | "defender" | null;

export interface PlayerSeatProps {
  name: string;
  cardCount: number;
  role: SeatRole;
  active: boolean;
  finished?: boolean;
}

function avatarColor(name: string): string {
  const palette = ["#C44536", "#3D7EA6", "#7B6CA6", "#2F8F6B", "#B07A2E"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

function MiniFan({ count }: { count: number }) {
  const shown = Math.min(count, 5);
  return (
    <View style={styles.fan}>
      {Array.from({ length: shown }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.miniCard,
            { left: i * 7, transform: [{ rotate: `${(i - (shown - 1) / 2) * 6}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

function PlayerSeatComponent({ name, cardCount, role, active, finished }: PlayerSeatProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.container, active && styles.active, finished && styles.finished]}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: avatarColor(name) }]}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {role && (
            <Text style={[styles.role, role === "defender" ? styles.def : styles.atk]}>
              {role === "defender" ? "DEFENDING" : "ATTACKING"}
            </Text>
          )}
          {finished && <Text style={styles.out}>OUT</Text>}
        </View>
      </View>
      <View style={styles.cardsRow}>
        <MiniFan count={cardCount} />
        <Text style={styles.count}>{cardCount}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 104,
    padding: 8,
    borderRadius: radius.panel,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: "transparent",
  },
  active: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  finished: { opacity: 0.5 },
  row: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  info: { marginLeft: 8, flexShrink: 1 },
  name: { color: colors.textLight, fontWeight: "700", fontSize: 13 },
  role: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginTop: 1 },
  atk: { color: colors.danger },
  def: { color: colors.gold },
  out: { color: colors.textMuted, fontSize: 9, fontWeight: "800" },
  cardsRow: { flexDirection: "row", alignItems: "center", marginTop: 6, height: cardSize.small.h * 0.5 },
  fan: { width: 5 * 7 + cardSize.small.w * 0.6, height: "100%" },
  miniCard: {
    position: "absolute",
    top: 0,
    width: cardSize.small.w * 0.6,
    height: cardSize.small.h * 0.6,
    borderRadius: 4,
    backgroundColor: colors.cardBack,
    borderWidth: 1,
    borderColor: colors.cardBackAccent,
  },
  count: { color: colors.textLight, fontWeight: "800", marginLeft: 6 },
});

export const PlayerSeat = React.memo(PlayerSeatComponent);
