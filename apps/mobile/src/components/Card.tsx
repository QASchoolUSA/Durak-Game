import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  type Card as CardModel,
  RANK_LABELS,
  SUIT_SYMBOLS,
  isRed,
} from "@durak/game-core";
import { useCardTheme } from "../theme/CardThemeContext";
import { type CardTheme, type CardBackPattern } from "../theme/cardThemes";
import { colors, radius } from "../theme";

export interface CardProps {
  card?: CardModel;
  faceDown?: boolean;
  width?: number;
  height?: number;
  /** Highlight as a trump card. */
  trump?: boolean;
  /** Render greyed-out (e.g. not currently playable). */
  dimmed?: boolean;
  /** Highlight with a gold ring (e.g. selectable / active). */
  highlighted?: boolean;
  /** Override active card theme (e.g. design picker previews). */
  themeOverride?: CardTheme;
  style?: ViewStyle;
}

function CardBackPattern({
  pattern,
  accent,
}: {
  pattern: CardBackPattern;
  accent: string;
}) {
  switch (pattern) {
    case "diamond":
      return (
        <View
          style={[
            styles.backDiamond,
            { backgroundColor: accent },
          ]}
        />
      );
    case "stripe":
      return (
        <View style={styles.patternFill}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.backStripe,
                {
                  backgroundColor: accent,
                  top: `${8 + i * 18}%`,
                  opacity: 0.35 + (i % 2) * 0.15,
                },
              ]}
            />
          ))}
        </View>
      );
    case "crosshatch":
      return (
        <View style={styles.patternFill}>
          {[-1, 0, 1].map((i) => (
            <View
              key={`h-${i}`}
              style={[
                styles.backHatchLine,
                {
                  backgroundColor: accent,
                  transform: [{ rotate: "45deg" }, { translateY: i * 10 }],
                },
              ]}
            />
          ))}
          {[-1, 0, 1].map((i) => (
            <View
              key={`v-${i}`}
              style={[
                styles.backHatchLine,
                {
                  backgroundColor: accent,
                  transform: [{ rotate: "-45deg" }, { translateY: i * 10 }],
                },
              ]}
            />
          ))}
        </View>
      );
    case "dots":
      return (
        <View style={styles.patternFill}>
          {[
            { top: "22%" as const, left: "22%" as const },
            { top: "22%" as const, right: "22%" as const },
            { top: "50%" as const, left: "50%" as const },
            { bottom: "22%" as const, left: "22%" as const },
            { bottom: "22%" as const, right: "22%" as const },
          ].map((pos, i) => (
            <View
              key={i}
              style={[
                styles.backDot,
                pos,
                { backgroundColor: accent },
              ]}
            />
          ))}
        </View>
      );
    case "chevron":
      return (
        <View style={styles.patternFill}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.backChevron,
                {
                  borderBottomColor: accent,
                  opacity: 0.3 + i * 0.12,
                  transform: [{ scale: 1 - i * 0.22 }],
                },
              ]}
            />
          ))}
        </View>
      );
    case "rings":
      return (
        <View style={styles.patternFill}>
          {[0.72, 0.52, 0.34].map((scale, i) => (
            <View
              key={i}
              style={[
                styles.backRing,
                {
                  borderColor: accent,
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  opacity: 0.35 + i * 0.15,
                },
              ]}
            />
          ))}
        </View>
      );
  }
}

function CardCorner({
  label,
  symbol,
  color,
  cornerFont,
  cornerSuit,
  width,
  height,
  corner,
}: {
  label: string;
  symbol: string;
  color: string;
  cornerFont: number;
  cornerSuit: number;
  width: number;
  height: number;
  corner: "tl" | "br";
}) {
  const padH = Math.max(4, Math.round(width * 0.075));
  const padV = Math.max(3, Math.round(height * 0.04));
  const rankStyle = [
    styles.rank,
    { fontSize: cornerFont, lineHeight: Math.round(cornerFont * 1.05), color },
  ];
  const suitStyle = [
    styles.cornerSuit,
    {
      fontSize: cornerSuit,
      lineHeight: Math.round(cornerSuit * 1.1),
      color,
      marginTop: Math.round(-cornerFont * 0.08),
    },
  ];

  const cornerW = Math.round(width * 0.36);
  const cornerH = Math.round(height * 0.26);
  const isBR = corner === "br";

  const pip = (
    <>
      <Text style={rankStyle}>{label}</Text>
      <Text style={suitStyle}>{symbol}</Text>
    </>
  );

  if (isBR) {
    return (
      <View
        style={[
          styles.cornerAnchor,
          {
            bottom: padV,
            right: padH,
            width: cornerW,
            height: cornerH,
          },
        ]}
      >
        <View style={styles.cornerBRInner}>{pip}</View>
      </View>
    );
  }

  return (
    <View style={[styles.cornerAnchor, { top: padV, left: padH }]}>
      {pip}
    </View>
  );
}

function CardFace({
  card,
  width,
  height,
  trump,
  theme,
}: {
  card: CardModel;
  width: number;
  height: number;
  trump?: boolean;
  theme: CardTheme;
}) {
  const color = isRed(card.suit) ? theme.suitRed : theme.suitBlack;
  const label = RANK_LABELS[card.rank];
  const symbol = SUIT_SYMBOLS[card.suit];
  const cornerFont = Math.round(width * 0.26);
  const cornerSuit = Math.round(width * 0.22);
  const centerFont = Math.round(width * 0.55);

  return (
    <View
      style={[
        styles.base,
        styles.faceRoot,
        {
          width,
          height,
          backgroundColor: theme.face,
          borderColor: trump ? colors.gold : theme.faceEdge,
          borderWidth: trump ? 2 : 1,
        },
      ]}
    >
      <CardCorner
        corner="tl"
        label={label}
        symbol={symbol}
        color={color}
        cornerFont={cornerFont}
        cornerSuit={cornerSuit}
        width={width}
        height={height}
      />

      <View style={styles.centerWrap} pointerEvents="none">
        <Text style={[styles.center, { fontSize: centerFont, color }]}>{symbol}</Text>
      </View>

      <CardCorner
        corner="br"
        label={label}
        symbol={symbol}
        color={color}
        cornerFont={cornerFont}
        cornerSuit={cornerSuit}
        width={width}
        height={height}
      />
    </View>
  );
}

function CardBack({
  width,
  height,
  theme,
}: {
  width: number;
  height: number;
  theme: CardTheme;
}) {
  return (
    <View
      style={[
        styles.base,
        { width, height, backgroundColor: theme.back },
      ]}
    >
      <View
        style={[
          styles.backInner,
          { borderColor: theme.backAccent },
        ]}
      >
        <CardBackPattern pattern={theme.backPattern} accent={theme.backAccent} />
      </View>
    </View>
  );
}

function CardComponent({
  card,
  faceDown,
  width = 66,
  height = 92,
  trump,
  dimmed,
  highlighted,
  themeOverride,
  style,
}: CardProps) {
  const activeTheme = useCardTheme();
  const theme = themeOverride ?? activeTheme;

  return (
    <View
      style={[
        styles.shadow,
        { width, height, borderRadius: radius.card },
        highlighted && styles.highlight,
        dimmed && styles.dimmed,
        style,
      ]}
    >
      {faceDown || !card ? (
        <CardBack width={width} height={height} theme={theme} />
      ) : (
        <CardFace card={card} width={width} height={height} trump={trump} theme={theme} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  base: {
    borderRadius: radius.card,
    overflow: "hidden",
  },
  faceRoot: {
    position: "relative",
  },
  rank: {
    fontWeight: "800",
  },
  cornerSuit: {
    fontWeight: "700",
  },
  cornerAnchor: {
    position: "absolute",
    zIndex: 2,
  },
  cornerBRInner: {
    position: "absolute",
    bottom: 0,
    right: 0,
    alignItems: "center",
    transform: [{ rotate: "180deg" }],
  },
  centerWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  center: {
    fontWeight: "700",
    opacity: 0.9,
    textAlign: "center",
  },
  backInner: {
    flex: 1,
    margin: 4,
    borderRadius: radius.card - 3,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  patternFill: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  backDiamond: {
    width: "44%",
    height: "44%",
    transform: [{ rotate: "45deg" }],
    borderRadius: 4,
    opacity: 0.7,
  },
  backStripe: {
    position: "absolute",
    left: "8%",
    right: "8%",
    height: 3,
    borderRadius: 2,
  },
  backHatchLine: {
    position: "absolute",
    width: "120%",
    height: 2,
    opacity: 0.45,
    borderRadius: 1,
  },
  backDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.55,
    marginLeft: -3,
    marginTop: -3,
  },
  backChevron: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "180deg" }],
  },
  backRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  highlight: {
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    borderRadius: radius.card,
  },
  dimmed: {
    opacity: 0.45,
  },
});

export const Card = React.memo(CardComponent);
