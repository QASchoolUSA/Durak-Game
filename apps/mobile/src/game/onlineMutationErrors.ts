/** Map Convex mutation errors to user-facing status messages. */
export function formatOnlineMutationError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong.";

  const lower = message.toLowerCase();
  if (lower.includes("not allowed") || lower.includes("illegal")) {
    return "That move is not allowed right now.";
  }
  if (lower.includes("not your turn") || lower.includes("move player mismatch")) {
    return "It is not your turn.";
  }
  if (lower.includes("not in progress") || lower.includes("not playing")) {
    return "The game is not in progress.";
  }
  if (lower.includes("not authenticated")) {
    return "Still signing in — wait a moment and try again.";
  }
  if (lower.includes("not a member")) {
    return "You are no longer in this room.";
  }
  if (lower.includes("not enough gold") || lower.includes("wallet")) {
    return "Not enough gold.";
  }
  if (lower.includes("return")) {
    return "Return is not available right now.";
  }
  if (lower.includes("reveal")) {
    return "Reveal failed.";
  }
  return message;
}
