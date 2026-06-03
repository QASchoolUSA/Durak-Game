import {
  APPEARANCE_ORDER,
  APPEARANCE_PRESETS,
  DEFAULT_APPEARANCE,
  type AppearanceId,
  resolveAppearanceId,
} from "./appearanceThemes";

export interface TableTheme {
  id: TableDesignId;
  name: string;
  tagline: string;
  backgroundColor: string;
  backgroundGradient?: [string, string];
}

export type TableDesignId = AppearanceId;

export const DEFAULT_TABLE_DESIGN: TableDesignId = DEFAULT_APPEARANCE;

function buildTableTheme(id: AppearanceId): TableTheme {
  const preset = APPEARANCE_PRESETS[id];
  return {
    id,
    name: preset.name,
    tagline: preset.tagline,
    backgroundColor: preset.table.backgroundColor,
    backgroundGradient: preset.table.backgroundGradient,
  };
}

export const TABLE_THEMES: Record<TableDesignId, TableTheme> = Object.fromEntries(
  APPEARANCE_ORDER.map((id) => [id, buildTableTheme(id)]),
) as Record<TableDesignId, TableTheme>;

export const TABLE_DESIGN_ORDER: TableDesignId[] = APPEARANCE_ORDER;

export function getTableTheme(id: TableDesignId): TableTheme {
  return TABLE_THEMES[id] ?? TABLE_THEMES[DEFAULT_TABLE_DESIGN];
}

export function resolveTableDesignId(value: string): TableDesignId | null {
  return resolveAppearanceId(value);
}

export function isValidTableDesignId(value: string): value is TableDesignId {
  return resolveTableDesignId(value) !== null;
}
