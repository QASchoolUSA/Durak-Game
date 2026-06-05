/** Dev-only render counter for perf profiling. */
let counters = new Map<string, number>();

export function bumpRenderCount(label: string): number {
  if (!__DEV__) return 0;
  const next = (counters.get(label) ?? 0) + 1;
  counters.set(label, next);
  return next;
}

export function getRenderCounts(): Map<string, number> {
  return new Map(counters);
}

export function resetRenderCounts(): void {
  counters = new Map();
}
