import { useState } from "react";
import {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
} from "react-native-reanimated";

/** Subscribe to a boolean SharedValue — re-renders only when the value changes. */
export function useSharedBool(
  sv: SharedValue<boolean> | undefined,
  fallback = false,
): boolean {
  const [value, setValue] = useState(fallback);

  useAnimatedReaction(
    () => sv?.value ?? fallback,
    (cur, prev) => {
      if (cur !== prev) {
        runOnJS(setValue)(cur);
      }
    },
    [sv, fallback],
  );

  return sv ? value : fallback;
}
