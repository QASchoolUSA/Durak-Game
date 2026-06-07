/** Responsive layout for table attack/defense pairs — scales down when slot is tight. */

import { pairLayoutWidth, TRANSFER_CHOICE_LAYOUT } from "./dropZones";

export const BASE_TABLE_CARD_W = 62;
export const BASE_TABLE_CARD_H = 87;

const BASE_PAIR_PAD_W = 16;
const BASE_DEFENSE_TOP = 14;
const BASE_DEFENSE_LEFT = 12;
const BASE_CONTAINER_PAD_H = 14;
const BASE_CONTAINER_PAD_V = 8;
const BASE_GAP = 14;
const TIGHT_GAP = 10;
const SLOT_MARGIN = 8;
/** Minimum readable table card width — matches MIN_CARD_W.table in gameLayout. */
const MIN_TABLE_CARD_W = 54;

export interface TableLayoutInput {
  pairCount: number;
  slotWidth: number;
  slotHeight: number;
  hasTransferChoice?: boolean;
  baseCardW?: number;
  baseCardH?: number;
}

export interface TableLayoutResult {
  cardW: number;
  cardH: number;
  columns: number;
  gap: number;
  pairPadW: number;
  defenseOffsetTop: number;
  defenseOffsetLeft: number;
  containerPadH: number;
  containerPadV: number;
  transferGap: number;
  scale: number;
}

export function tableColumns(pairCount: number): number {
  if (pairCount <= 1) return 1;
  if (pairCount <= 3) return pairCount;
  return 3;
}

function baseLayout(
  pairCount: number,
  baseCardW: number,
  baseCardH: number,
): TableLayoutResult {
  const columns = pairCount > 0 ? tableColumns(pairCount) : 1;
  const gap = pairCount >= 5 ? TIGHT_GAP : BASE_GAP;
  return {
    cardW: baseCardW,
    cardH: baseCardH,
    columns,
    gap,
    pairPadW: BASE_PAIR_PAD_W,
    defenseOffsetTop: BASE_DEFENSE_TOP,
    defenseOffsetLeft: BASE_DEFENSE_LEFT,
    containerPadH: BASE_CONTAINER_PAD_H,
    containerPadV: BASE_CONTAINER_PAD_V,
    transferGap: TRANSFER_CHOICE_LAYOUT.gap,
    scale: 1,
  };
}

function scaleLayout(layout: TableLayoutResult, factor: number): TableLayoutResult {
  const round = (n: number) => Math.round(n * factor);
  return {
    cardW: round(layout.cardW),
    cardH: round(layout.cardH),
    columns: layout.columns,
    gap: round(layout.gap),
    pairPadW: round(layout.pairPadW),
    defenseOffsetTop: round(layout.defenseOffsetTop),
    defenseOffsetLeft: round(layout.defenseOffsetLeft),
    containerPadH: round(layout.containerPadH),
    containerPadV: round(layout.containerPadV),
    transferGap: round(layout.transferGap),
    scale: layout.scale * factor,
  };
}

function gridFootprint(
  layout: TableLayoutResult,
  pairCount: number,
  hasTransferChoice: boolean,
): { width: number; height: number } {
  const columns = layout.columns;
  const rows = Math.ceil(pairCount / columns);
  const pairW = pairLayoutWidth(hasTransferChoice, layout.cardW, layout.transferGap);
  const gridW =
    columns * pairW + Math.max(0, columns - 1) * layout.gap + 2 * layout.containerPadH;
  const rowH = layout.cardH + layout.defenseOffsetTop;
  const gridH =
    rows * rowH + Math.max(0, rows - 1) * layout.gap + 2 * layout.containerPadV;
  return { width: gridW, height: gridH };
}

export function computeTableLayout(input: TableLayoutInput): TableLayoutResult {
  const baseCardW = input.baseCardW ?? BASE_TABLE_CARD_W;
  const baseCardH = input.baseCardH ?? BASE_TABLE_CARD_H;
  const hasTransferChoice = input.hasTransferChoice ?? false;

  if (input.pairCount <= 0) {
    return baseLayout(0, baseCardW, baseCardH);
  }

  let layout = baseLayout(input.pairCount, baseCardW, baseCardH);
  const { slotWidth, slotHeight } = input;

  if (slotWidth <= 0 || slotHeight <= 0) {
    return layout;
  }

  const footprint = gridFootprint(layout, input.pairCount, hasTransferChoice);
  const availW = slotWidth - SLOT_MARGIN;
  const availH = slotHeight - SLOT_MARGIN;

  if (footprint.width <= availW && footprint.height <= availH) {
    return layout;
  }

  const fitScaleW = availW / footprint.width;
  const fitScaleH = availH / footprint.height;
  const fitScale = Math.min(fitScaleW, fitScaleH, 1);
  const minTableScale = MIN_TABLE_CARD_W / baseCardW;
  const finalScale = Math.max(fitScale, minTableScale);

  return scaleLayout(layout, finalScale);
}

/** Split pair indices into grid rows for TableArea rendering. */
export function tablePairRows(pairCount: number, columns: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < pairCount; i += columns) {
    const row: number[] = [];
    for (let j = i; j < Math.min(i + columns, pairCount); j++) row.push(j);
    rows.push(row);
  }
  return rows;
}
