import type { Move } from "@durak/game-core";

type SubmitFn = (move: Move) => void;

let submitMoveFn: SubmitFn | null = null;

export function registerOnlineMoveSubmit(fn: SubmitFn | null): void {
  submitMoveFn = fn;
}

export function submitOnlineMove(move: Move): void {
  submitMoveFn?.(move);
}
