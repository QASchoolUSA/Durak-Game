import { useState } from "react";
import { runOnJS, type SharedValue, useAnimatedReaction } from "react-native-reanimated";

/** Subscribe to a numeric SharedValue — re-renders only when the value changes. */
export function useSharedIndex(sv: SharedValue<number> | undefined, fallback = -1): number {
  const [index, setIndex] = useState(fallback);

  useAnimatedReaction(
    () => sv?.value ?? fallback,
    (value, prev) => {
      if (value !== prev) {
        runOnJS(setIndex)(value);
      }
    },
    [sv, fallback],
  );

  return sv ? index : fallback;
}
