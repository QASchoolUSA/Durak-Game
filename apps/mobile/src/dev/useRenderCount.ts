import { useRef } from "react";
import { bumpRenderCount } from "./renderCount";

/** Call at top of a component body to track renders in the perf overlay. */
export function useRenderCount(label: string): void {
  const first = useRef(true);
  if (__DEV__) {
    bumpRenderCount(label);
    if (first.current) first.current = false;
  }
}
