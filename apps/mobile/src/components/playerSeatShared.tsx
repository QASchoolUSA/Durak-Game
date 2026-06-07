import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SeatIndication } from "../game/selectors";
import { colors } from "../theme";

const AVATAR_PALETTE = ["#C44536", "#2D7EA6", "#7B5EA6", "#2E8F6B", "#A0722A", "#4A8A9B"];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]!;
}

export function indicationColor(indication: SeatIndication): string {
  return indication === "play" ? colors.success : colors.danger;
}

export function indicationShadowColor(indication: SeatIndication): string {
  return indicationColor(indication);
}

export interface PlayerAvatarProps {
  name: string;
  size?: number;
}

export function PlayerAvatar({ name, size = 28 }: PlayerAvatarProps) {
  const letterSize = Math.round(size * 0.42);
  return (
    <View
      style={[
        avatarStyles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(name),
        },
      ]}
    >
      <Text style={[avatarStyles.avatarLetter, { fontSize: letterSize }]}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontWeight: "900",
  },
});
