import React from "react";
import { PixelRatio, Platform, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
  /** Simpler back for small deck pile cards. */
  compact?: boolean;
  /** Override active card theme (e.g. design picker previews). */
  themeOverride?: CardTheme;
  style?: ViewStyle | ViewStyle[];
}

function CornerBracket({
  accent,
  corner,
}: {
  accent: string;
  corner: "tl" | "tr" | "bl" | "br";
}) {
  const positionStyle =
    corner === "tl"
      ? styles.bracketTL
      : corner === "tr"
        ? styles.bracketTR
        : corner === "bl"
          ? styles.bracketBL
          : styles.bracketBR;

  const armStyles =
    corner === "tl"
      ? [styles.bracketArmHLeft, styles.bracketArmVTop]
      : corner === "tr"
        ? [styles.bracketArmHRight, styles.bracketArmVRight]
        : corner === "bl"
          ? [styles.bracketArmHBottomLeft, styles.bracketArmVBottom]
          : [styles.bracketArmHBottomRight, styles.bracketArmVBottomRight];

  return (
    <View style={[styles.cornerBracket, positionStyle]}>
      <View style={[styles.bracketArmH, armStyles[0], { backgroundColor: accent }]} />
      <View style={[styles.bracketArmV, armStyles[1], { backgroundColor: accent }]} />
    </View>
  );
}

function CrestPattern({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  const dotPositions = [
    { top: "28%", left: "28%" },
    { top: "28%", right: "28%" },
    { bottom: "28%", left: "28%" },
    { bottom: "28%", right: "28%" },
  ] as const;

  return (
    <View style={styles.patternFill}>
      {(["tl", "tr", "bl", "br"] as const).map((corner) => (
        <CornerBracket key={corner} accent={accent} corner={corner} />
      ))}
      {dotPositions.map((pos, i) => (
        <View
          key={i}
          style={[styles.crestDot, pos, { backgroundColor: accentSoft }]}
        />
      ))}
      <View
        style={[
          styles.crestHollowDiamond,
          { borderColor: accent },
        ]}
      />
      <View
        style={[
          styles.crestInnerGem,
          { backgroundColor: accent },
        ]}
      />
    </View>
  );
}

function SealPattern({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  const ringScales = [
    { scale: 0.72, opacity: 0.55, soft: false },
    { scale: 0.52, opacity: 0.75, soft: true },
    { scale: 0.32, opacity: 0.9, soft: false },
  ] as const;

  const gemPositions = [
    { top: "24%", left: "50%" },
    { bottom: "24%", left: "50%" },
    { top: "50%", left: "24%" },
    { top: "50%", right: "24%" },
  ] as const;

  return (
    <View style={styles.patternFill}>
      {ringScales.map(({ scale, opacity, soft }, i) => (
        <View
          key={i}
          style={[
            styles.sealRing,
            {
              width: `${scale * 100}%`,
              height: `${scale * 100}%`,
              borderColor: soft ? accentSoft : accent,
              opacity,
            },
          ]}
        />
      ))}
      {gemPositions.map((pos, i) => (
        <View
          key={i}
          style={[
            styles.sealGem,
            pos,
            { backgroundColor: accentSoft },
          ]}
        />
      ))}
      <View style={[styles.sealCenter, { backgroundColor: accent }]} />
    </View>
  );
}

function WeavePattern({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  return (
    <View style={styles.patternFill}>
      {[-2, -1, 0, 1, 2].map((i) => (
        <View
          key={`d-${i}`}
          style={[
            styles.weaveLine,
            {
              backgroundColor: accentSoft,
              transform: [{ rotate: "45deg" }, { translateY: i * 9 }],
            },
          ]}
        />
      ))}
      {[-2, -1, 0, 1, 2].map((i) => (
        <View
          key={`c-${i}`}
          style={[
            styles.weaveLine,
            {
              backgroundColor: accentSoft,
              transform: [{ rotate: "-45deg" }, { translateY: i * 9 }],
            },
          ]}
        />
      ))}
      <View style={[styles.weaveBand, { backgroundColor: accent }]} />
      <View
        style={[
          styles.weaveNotch,
          { borderColor: accentSoft },
        ]}
      />
    </View>
  );
}

function SunburstPattern({ accent, accentSoft }: { accent: string; accentSoft: string }) {
  return (
    <View style={styles.patternFill}>
      <View style={[styles.sunburstOuterRing, { borderColor: accentSoft }]} />
      {Array.from({ length: 8 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.sunburstSpoke,
            {
              backgroundColor: i % 2 === 0 ? accent : accentSoft,
              transform: [{ rotate: `${i * 22.5}deg` }],
            },
          ]}
        />
      ))}
      <View style={[styles.sunburstRosetteRing, { borderColor: accent }]} />
      <View style={[styles.sunburstRosette, { backgroundColor: accent }]} />
    </View>
  );
}

const CardBackPattern = React.memo(function CardBackPattern({
  pattern,
  accent,
  accentSoft,
}: {
  pattern: CardBackPattern;
  accent: string;
  accentSoft: string;
}) {
  switch (pattern) {
    case "crest":
      return <CrestPattern accent={accent} accentSoft={accentSoft} />;
    case "seal":
      return <SealPattern accent={accent} accentSoft={accentSoft} />;
    case "weave":
      return <WeavePattern accent={accent} accentSoft={accentSoft} />;
    case "sunburst":
      return <SunburstPattern accent={accent} accentSoft={accentSoft} />;
  }
});

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
    <LinearGradient
      colors={["#FFFFFF", theme.face]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.base,
        styles.faceRoot,
        StyleSheet.absoluteFill,
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
    </LinearGradient>
  );
}

function CardBack({
  width,
  height,
  theme,
  compact = false,
}: {
  width: number;
  height: number;
  theme: CardTheme;
  compact?: boolean;
}) {
  const startColor = theme.backLight ?? theme.back;
  const endColor = theme.back;

  return (
    <View
      style={[
        styles.base,
        StyleSheet.absoluteFill,
      ]}
    >
      <View
        style={[
          styles.backOuterRim,
          { borderColor: theme.backAccent },
        ]}
      />
      <LinearGradient
        colors={[startColor, endColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backPanel}
      >
        <View
          style={[
            styles.backFrameOuter,
            { borderColor: theme.backAccent },
          ]}
        />
        {!compact && (
          <>
            <View
              style={[
                styles.backFrameInner,
                { borderColor: theme.backAccent },
              ]}
            />
            <CardBackPattern
              pattern={theme.backPattern}
              accent={theme.backAccent}
              accentSoft={theme.backAccentSoft ?? theme.backAccent}
            />
          </>
        )}
      </LinearGradient>
    </View>
  );
}

const pixelSnap = (n: number) => PixelRatio.roundToNearestPixel(n);

function CardComponent({
  card,
  faceDown,
  width = 66,
  height = 92,
  trump,
  dimmed,
  highlighted,
  compact,
  themeOverride,
  style,
}: CardProps) {
  const activeTheme = useCardTheme();
  const theme = themeOverride ?? activeTheme;

  const isFaceDown = faceDown || !card;
  const isTrump = !isFaceDown && trump;

  // Pixel-snap dimensions to prevent sub-pixel blurriness
  const w = pixelSnap(width);
  const h = pixelSnap(height);

  const borderColor = isFaceDown
    ? "rgba(0,0,0,0.18)"
    : isTrump
      ? colors.goldBright
      : theme.faceEdge;

  return (
    <View
      style={[
        styles.cardShadow,
        {
          width: w,
          height: h,
          borderRadius: radius.card,
          // Opaque background matching the body lets iOS derive a cheap
          // shadowPath instead of rasterizing the layer offscreen each frame.
          backgroundColor: isFaceDown ? theme.back : theme.face,
        },
        highlighted && styles.highlight,
        dimmed && styles.dimmed,
        style,
      ]}
    >
      {/* Rasterised card body — rendered at native resolution for pixel-perfect edges */}
      <View
        style={[
          styles.cardBody,
          {
            width: w,
            height: h,
            borderRadius: radius.card,
            backgroundColor: isFaceDown ? theme.back : theme.face,
            borderWidth: isTrump ? 1.5 : 1,
            borderColor,
          },
        ]}
      >
        {isFaceDown ? (
          <CardBack width={w} height={h} theme={theme} compact={compact} />
        ) : (
          <CardFace card={card} width={w} height={h} trump={trump} theme={theme} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardBody: {
    overflow: "hidden",
    ...(Platform.OS === "ios" ? { borderCurve: "continuous" as const } : {}),
  },
  base: {
    borderRadius: radius.card,
    overflow: "hidden",
    ...(Platform.OS === "ios" ? { borderCurve: "continuous" as const } : {}),
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
  backOuterRim: {
    ...StyleSheet.absoluteFill,
    margin: 2,
    borderRadius: radius.card - 2,
    borderWidth: 1.5,
    opacity: 0.55,
  },
  backPanel: {
    flex: 1,
    margin: "5%",
    borderRadius: radius.card - 4,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  backFrameOuter: {
    ...StyleSheet.absoluteFill,
    margin: "6%",
    borderRadius: radius.card - 5,
    borderWidth: 2,
  },
  backFrameInner: {
    ...StyleSheet.absoluteFill,
    margin: "10%",
    borderRadius: radius.card - 6,
    borderWidth: 1,
    opacity: 0.38,
  },
  patternFill: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerBracket: {
    position: "absolute",
    width: "14%",
    height: "14%",
  },
  bracketTL: { top: "16%", left: "16%" },
  bracketTR: { top: "16%", right: "16%" },
  bracketBL: { bottom: "16%", left: "16%" },
  bracketBR: { bottom: "16%", right: "16%" },
  bracketArmH: {
    position: "absolute",
    height: 2,
    width: "100%",
    borderRadius: 1,
  },
  bracketArmHLeft: { top: 0, left: 0 },
  bracketArmHRight: { top: 0, right: 0 },
  bracketArmHBottomLeft: { bottom: 0, left: 0 },
  bracketArmHBottomRight: { bottom: 0, right: 0 },
  bracketArmV: {
    position: "absolute",
    width: 2,
    height: "100%",
    borderRadius: 1,
  },
  bracketArmVTop: { top: 0, left: 0 },
  bracketArmVBottom: { bottom: 0, left: 0 },
  bracketArmVRight: { top: 0, right: 0 },
  bracketArmVBottomRight: { bottom: 0, right: 0 },
  crestDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.45,
    marginLeft: -2,
    marginTop: -2,
  },
  crestHollowDiamond: {
    width: "38%",
    height: "38%",
    transform: [{ rotate: "45deg" }],
    borderRadius: 3,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  crestInnerGem: {
    position: "absolute",
    width: "16%",
    height: "16%",
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
    opacity: 0.92,
  },
  sealRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },
  sealGem: {
    position: "absolute",
    width: "7%",
    height: "7%",
    transform: [{ rotate: "45deg" }],
    borderRadius: 1,
    marginLeft: "-3.5%",
    marginTop: "-3.5%",
    opacity: 0.6,
  },
  sealCenter: {
    width: "10%",
    height: "10%",
    borderRadius: 999,
    opacity: 0.95,
  },
  weaveLine: {
    position: "absolute",
    width: "130%",
    height: 2,
    borderRadius: 1,
    opacity: 0.35,
  },
  weaveBand: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "46%",
    height: "8%",
    opacity: 0.55,
    borderRadius: 2,
  },
  weaveNotch: {
    position: "absolute",
    width: "14%",
    height: "14%",
    transform: [{ rotate: "45deg" }],
    borderWidth: 2,
    backgroundColor: "transparent",
    borderRadius: 2,
  },
  sunburstSpoke: {
    position: "absolute",
    width: 2,
    height: "42%",
    top: "9%",
    borderRadius: 1,
    opacity: 0.7,
  },
  sunburstOuterRing: {
    position: "absolute",
    width: "68%",
    height: "68%",
    borderRadius: 999,
    borderWidth: 2,
    opacity: 0.5,
  },
  sunburstRosetteRing: {
    position: "absolute",
    width: "22%",
    height: "22%",
    borderRadius: 999,
    borderWidth: 2,
    opacity: 0.85,
  },
  sunburstRosette: {
    width: "14%",
    height: "14%",
    borderRadius: 999,
    opacity: 0.95,
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
