export type AccountKindOverride = "guest" | "registered" | null;

export type AccountStatusLike = {
  isAnonymous: boolean;
  email: string | null;
} | null | undefined;

/** Pure derivation for guest vs registered — testable without React. */
export function resolveAccountKind(
  status: AccountStatusLike,
  override: AccountKindOverride,
): { isGuest: boolean; email: string | null } {
  if (override === "registered") {
    return { isGuest: false, email: status?.email ?? null };
  }
  if (override === "guest") {
    return { isGuest: true, email: null };
  }
  return {
    isGuest: status?.isAnonymous ?? true,
    email: status?.email ?? null,
  };
}
