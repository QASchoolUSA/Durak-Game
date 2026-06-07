import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";

export type CoinVariant = "gold" | "credit";

export interface CoinIconProps {
  variant: CoinVariant;
  size?: number;
}

export function CoinIcon({ variant, size = 18 }: CoinIconProps) {
  const radius = size / 2;

  if (variant === "gold") {
    return (
      <View
        style={[
          styles.coinOuter,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: colors.goldDim,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.goldBright, colors.gold, colors.goldDeep]}
          locations={[0, 0.45, 1]}
          style={[styles.coinFill, { borderRadius: radius - 1 }]}
        >
          <View style={[styles.goldShine, { width: size * 0.35, height: size * 0.2 }]} />
          <Text style={[styles.goldMark, { fontSize: size * 0.42 }]}>G</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.coinOuter,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: "#2D8A5E",
          backgroundColor: "#3CB371",
        },
      ]}
    >
      <View
        style={[
          styles.creditInner,
          {
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
          },
        ]}
      >
        <Text style={[styles.creditMark, { fontSize: size * 0.44 }]}>¢</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coinOuter: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  coinFill: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  goldShine: {
    position: "absolute",
    top: 2,
    left: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  goldMark: {
    color: colors.goldDeep,
    fontWeight: "900",
    lineHeight: 14,
  },
  creditInner: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    backgroundColor: "#46A758",
  },
  creditMark: {
    color: "#E8FFF0",
    fontWeight: "800",
    lineHeight: 14,
  },
});
