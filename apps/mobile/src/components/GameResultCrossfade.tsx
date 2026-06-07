import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { GameState } from "@durak/game-core";
import { useReduceMotion } from "../hooks/useReduceMotion";
import type { Screen } from "../game/store";
import { GameScreen } from "../screens/GameScreen";
import { ResultScreen } from "../screens/ResultScreen";
import { colors } from "../theme";

export const FADE_TO_RESULT_MS = 350;
const FADE_TO_GAME_MS = 200;
const RESULT_FADE_FALLBACK_MS = FADE_TO_RESULT_MS + 50;

type GameResultCrossfadeProps = {
  screen: Screen;
  game: GameState | null;
  onOpenSettings: () => void;
  errorBoundary: (children: React.ReactNode) => React.ReactNode;
  resultErrorBoundary: (children: React.ReactNode) => React.ReactNode;
};

export function GameResultCrossfade({
  screen,
  game,
  onOpenSettings,
  errorBoundary,
  resultErrorBoundary,
}: GameResultCrossfadeProps) {
  const reduceMotion = useReduceMotion();
  const prevScreenRef = useRef(screen);
  const gameOpacity = useSharedValue(1);
  const resultOpacity = useSharedValue(0);
  const [resultReady, setResultReady] = useState(screen === "result");
  const [rematchCrossfade, setRematchCrossfade] = useState(false);

  const inGameResultFlow = screen === "game" || screen === "result";

  useLayoutEffect(() => {
    if (!inGameResultFlow) {
      prevScreenRef.current = screen;
      setResultReady(false);
      setRematchCrossfade(false);
      gameOpacity.value = 1;
      resultOpacity.value = 0;
      return;
    }

    const prev = prevScreenRef.current;
    prevScreenRef.current = screen;

    if (reduceMotion) {
      setRematchCrossfade(false);
      cancelAnimation(gameOpacity);
      cancelAnimation(resultOpacity);
      gameOpacity.value = screen === "game" ? 1 : 0;
      resultOpacity.value = screen === "result" ? 1 : 0;
      setResultReady(screen === "result");
      return;
    }

    if (prev === "game" && screen === "result") {
      setRematchCrossfade(false);
      setResultReady(false);
      cancelAnimation(resultOpacity);
      resultOpacity.value = 0;
      resultOpacity.value = withTiming(
        1,
        { duration: FADE_TO_RESULT_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setResultReady)(true);
        },
      );
      return;
    }

    if (prev === "result" && screen === "game") {
      setResultReady(false);
      setRematchCrossfade(true);
      cancelAnimation(gameOpacity);
      cancelAnimation(resultOpacity);
      gameOpacity.value = 0;
      resultOpacity.value = 1;
      gameOpacity.value = withTiming(1, {
        duration: FADE_TO_GAME_MS,
        easing: Easing.out(Easing.cubic),
      });
      resultOpacity.value = withTiming(
        0,
        { duration: FADE_TO_GAME_MS, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setRematchCrossfade)(false);
        },
      );
      return;
    }

    setRematchCrossfade(false);
    cancelAnimation(gameOpacity);
    cancelAnimation(resultOpacity);
    gameOpacity.value = screen === "game" ? 1 : 0;
    resultOpacity.value = screen === "result" ? 1 : 0;
    setResultReady(screen === "result");
  }, [screen, inGameResultFlow, reduceMotion, gameOpacity, resultOpacity]);

  useEffect(() => {
    if (screen !== "result" || reduceMotion || resultReady) return;

    const id = setTimeout(() => {
      cancelAnimation(resultOpacity);
      resultOpacity.value = 1;
      setResultReady(true);
    }, RESULT_FADE_FALLBACK_MS);

    return () => clearTimeout(id);
  }, [screen, reduceMotion, resultReady, resultOpacity]);

  const gameLayerStyle = useAnimatedStyle(() => ({
    opacity: gameOpacity.value,
  }));

  const resultLayerStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
  }));

  if (!inGameResultFlow) {
    return null;
  }

  const gameContent = errorBoundary(
    <GameScreen onOpenSettings={onOpenSettings} />,
  );

  const resultContent = resultErrorBoundary(
    <ResultScreen celebrateReady={resultReady} />,
  );

  if (screen === "game" && !rematchCrossfade) {
    if (game == null) {
      return <View style={styles.host} />;
    }
    return <View style={styles.host}>{gameContent}</View>;
  }

  if (screen === "result" && !rematchCrossfade) {
    return (
      <View style={styles.host}>
        <Animated.View style={[styles.resultLayer, resultLayerStyle]}>
          {resultContent}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.host} pointerEvents="box-none">
      {rematchCrossfade && game != null && (
        <Animated.View
          style={[styles.layer, gameLayerStyle]}
          pointerEvents={screen === "game" ? "auto" : "none"}
        >
          {gameContent}
        </Animated.View>
      )}
      <Animated.View
        style={[styles.layer, resultLayerStyle]}
        pointerEvents={screen === "result" ? "auto" : "none"}
      >
        {resultContent}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: colors.feltBottom,
  },
  resultLayer: {
    flex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFill,
  },
});
