import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { computeGameLayout } from "./gameLayout";

/** Height- and safe-area-aware responsive layout for all screens. */
export function useGameLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(
    () =>
      computeGameLayout({
        width,
        height,
        insets: {
          top: insets.top,
          bottom: insets.bottom,
          left: insets.left,
          right: insets.right,
        },
      }),
    [width, height, insets.top, insets.bottom, insets.left, insets.right],
  );
}
