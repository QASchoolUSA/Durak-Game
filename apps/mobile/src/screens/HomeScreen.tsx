import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Background } from "../components/Background";
import { CardFan } from "../components/CardFan";
import { GameConfigDrawer } from "../components/GameConfigDrawer";
import { MenuButton } from "../components/MenuButton";
import { colors, layoutFor, spacing, typography } from "../theme";

export interface HomeScreenProps {
  onOpenSettings: () => void;
  onOpenRules:    () => void;
}

export function HomeScreen({ onOpenSettings, onOpenRules }: HomeScreenProps) {
  const { width }  = useWindowDimensions();
  const lay        = layoutFor(width);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Background>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, { paddingHorizontal: lay.hPad }]}>

          {/* ── Decorative card fan ── */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.fanWrap}>
            <CardFan />
          </Animated.View>

          {/* ── Title ── */}
          <GlowTitle />

          {/* ── Menu buttons ── */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(500)}
            style={[styles.menu, { maxWidth: lay.maxContent }]}
          >
            <MenuButton
              label="PLAY"
              variant="primary"
              onPress={() => setDrawerOpen(true)}
              icon="▶"
            />
            <MenuButton
              label="SETTINGS"
              variant="secondary"
              onPress={onOpenSettings}
              icon="⚙"
            />
            <MenuButton
              label="HOW TO PLAY"
              variant="ghost"
              onPress={onOpenRules}
              icon="?"
            />
          </Animated.View>

          {/* ── Footer ── */}
          <Text style={styles.version}>v1.0 · Durak Card Game</Text>
        </View>
      </SafeAreaView>

      {/* ── Game config drawer ── */}
      <GameConfigDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Background>
  );
}

// ── Animated glowing title ────────────────────────────────────────────────────

function GlowTitle() {
  const glow = useSharedValue(0.75);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1.0,  { duration: 1800 }),
        withTiming(0.72, { duration: 1800 }),
      ),
      -1,
      true,
    );
  }, [glow]);

  const aStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.titleBlock}>
      <Animated.Text style={[styles.heroTitle, aStyle]}>DURAK</Animated.Text>
      <Text style={styles.heroSub}>Russian Card Game</Text>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  fanWrap: {
    height:         150,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   spacing.lg,
  },
  titleBlock: {
    alignItems:    "center",
    marginBottom:  spacing.xxl,
  },
  heroTitle: {
    ...typography.hero,
    color:           colors.gold,
    textShadowColor: colors.gold,
    textShadowOffset:{ width: 0, height: 0 },
    textShadowRadius: 24,
  },
  heroSub: {
    ...typography.caption,
    color:         colors.textMuted,
    letterSpacing: 2.5,
    marginTop:     spacing.xs,
  },
  menu: {
    width:      "100%",
    alignSelf:  "center",
    gap:        spacing.sm,
  },
  version: {
    ...typography.caption,
    color:     colors.textFaint,
    marginTop: spacing.xl,
  },
});
