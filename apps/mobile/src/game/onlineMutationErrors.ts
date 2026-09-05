/** Map Convex mutation errors to user-facing status messages. */
import { i18n } from "../i18n/i18n";

export function formatOnlineMutationError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : i18n.t("common.somethingWentWrong");

  const lower = message.toLowerCase();
  if (lower.includes("not allowed") || lower.includes("illegal")) {
    return i18n.t("errors.moveNotAllowed");
  }
  if (lower.includes("not your turn") || lower.includes("move player mismatch")) {
    return i18n.t("errors.notYourTurn");
  }
  if (lower.includes("not in progress") || lower.includes("not playing")) {
    return i18n.t("errors.notInProgress");
  }
  if (lower.includes("not authenticated")) {
    return i18n.t("errors.stillSigningIn");
  }
  if (lower.includes("not a member")) {
    return i18n.t("errors.notInRoom");
  }
  if (lower.includes("not enough gold") || lower.includes("wallet")) {
    return i18n.t("common.notEnoughGold");
  }
  if (lower.includes("return")) {
    return i18n.t("errors.returnUnavailable");
  }
  if (lower.includes("reveal")) {
    return i18n.t("errors.revealFailed");
  }
  return message;
}
