/** Compact display for pot / buy-in / gold amounts in header chips. */
export function formatEconomyAmount(n: number): string {
  const safe = Math.max(0, Math.floor(n));
  if (safe < 1000) return safe.toLocaleString("en-US");
  if (safe < 10_000) {
    const k = safe / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (safe < 1_000_000) return `${Math.round(safe / 1000)}k`;
  return `${(safe / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
