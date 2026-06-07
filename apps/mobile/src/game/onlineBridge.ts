import type { Move } from "@durak/game-core";

type SubmitFn = (move: Move) => void;
type VoidFn = () => void;

let submitMoveFn: SubmitFn | null = null;
let returnFn: VoidFn | null = null;

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
