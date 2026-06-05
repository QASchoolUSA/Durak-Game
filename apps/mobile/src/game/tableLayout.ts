/** Responsive layout for table attack/defense pairs — grid only; cards stay full size. */

import { TRANSFER_CHOICE_LAYOUT } from "./dropZones";

export const BASE_TABLE_CARD_W = 62;
export const BASE_TABLE_CARD_H = 87;

const BASE_PAIR_PAD_W = 16;
const BASE_DEFENSE_TOP = 14;
const BASE_DEFENSE_LEFT = 12;
const BASE_CONTAINER_PAD_H = 14;
const BASE_CONTAINER_PAD_V = 8;
const BASE_GAP = 14;
const TIGHT_GAP = 10;

export interface TableLayoutInput {
  pairCount: number;
  slotWidth: number;
  slotHeight: number;
  hasTransferChoice?: boolean;
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

function baseLayout(pairCount: number): TableLayoutResult {
  const columns = pairCount > 0 ? tableColumns(pairCount) : 1;
  const gap = pairCount >= 5 ? TIGHT_GAP : BASE_GAP;
  return {
    cardW: BASE_TABLE_CARD_W,
    cardH: BASE_TABLE_CARD_H,
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

export function computeTableLayout(input: TableLayoutInput): TableLayoutResult {
  void input.slotWidth;
  void input.slotHeight;
  void input.hasTransferChoice;
  if (input.pairCount <= 0) {
    return baseLayout(0);
  }
  return baseLayout(input.pairCount);
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
