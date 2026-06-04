import {
  APPEARANCE_ORDER,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  type AppearanceId,
  type AppearancePreset,
} from "./appearanceThemes";

const TEXT_LIGHT = "#F5F3EC";
const TEXT_MUTED = "#A8BAB2";
const TEXT_FAINT = "#6B8078";

export interface UiTheme {
  id: AppearanceId;
  panelBg: string;
  panelBorder: string;
  panelBorderSoft: string;
  accent: string;
  accentSoft: string;
  accentMuted: string;
  textPrimary: string;
  textMuted: string;
  textFaint: string;
  badgeBg: string;
  badgeText: string;
  activeTint: string;
  urgentBg: string;
  feltEdge: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function buildUiTheme(preset: AppearancePreset): UiTheme {
  const { card, mode, id } = preset;
  const isLight = mode === "light";
  const accent = card.backAccent;
  const accentSoft = card.backAccentSoft ?? mixHex(accent, card.back, 0.35);
  const panelBase = isLight ? (card.backLight ?? card.back) : card.back;

  return {
    id,
    panelBg: isLight ? withAlpha(panelBase, 0.92) : withAlpha(panelBase, 0.78),
    panelBorder: withAlpha(accent, isLight ? 0.42 : 0.32),
    panelBorderSoft: withAlpha(accent, isLight ? 0.22 : 0.16),
    accent,
    accentSoft: withAlpha(accent, isLight ? 0.14 : 0.18),
    accentMuted: withAlpha(accentSoft, isLight ? 0.55 : 0.65),
    textPrimary: isLight ? mixHex(card.backAccent, "#1B1B1F", 0.35) : TEXT_LIGHT,
    textMuted: isLight ? withAlpha(mixHex(card.backAccent, "#1B1B1F", 0.5), 0.85) : TEXT_MUTED,
    textFaint: isLight ? withAlpha(mixHex(card.backAccent, "#1B1B1F", 0.55), 0.65) : TEXT_FAINT,
    badgeBg: accent,
    badgeText: isLight ? card.backLight ?? card.back : card.back,
    activeTint: withAlpha(accent, isLight ? 0.08 : 0.06),
    urgentBg: withAlpha(accent, isLight ? 0.16 : 0.14),
    feltEdge: isLight ? mixHex(card.backAccent, panelBase, 0.15) : mixHex(card.back, "#000000", 0.25),
  };
}

const UI_THEMES: Record<AppearanceId, UiTheme> = Object.fromEntries(
  APPEARANCE_ORDER.map((id) => [id, buildUiTheme(APPEARANCE_PRESETS[id])]),
) as Record<AppearanceId, UiTheme>;

export function getUiTheme(id: AppearanceId): UiTheme {
  return UI_THEMES[id] ?? UI_THEMES[DEFAULT_APPEARANCE];
}
