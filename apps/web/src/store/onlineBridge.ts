import type { Move } from "@durak/game-core";

type SubmitFn = (move: Move) => void;
type VoidFn = () => void;
type UpdateDisplayNameFn = (displayName: string) => void;

let submitMoveFn: SubmitFn | null = null;
let returnFn: VoidFn | null = null;
let updateDisplayNameFn: UpdateDisplayNameFn | null = null;

export function registerOnlineMoveSubmit(fn: SubmitFn | null): void {
  submitMoveFn = fn;
}

export function submitOnlineMove(move: Move): void {
  submitMoveFn?.(move);
}

export function registerOnlineReturn(fn: VoidFn | null): void {
  returnFn = fn;
}

export function submitOnlineReturn(): void {
  returnFn?.();
}

export function registerUpdateDisplayName(fn: UpdateDisplayNameFn | null): void {
  updateDisplayNameFn = fn;
}

export function submitUpdateDisplayName(displayName: string): void {
  updateDisplayNameFn?.(displayName);
}
