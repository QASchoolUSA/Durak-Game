export const MAX_DISPLAY_NAME_LENGTH = 12;

export function normalizeDisplayName(name: string): string {
  return name.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
}
