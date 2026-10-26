export function onlineRules(config: {
  variant: "podkidnoy" | "perevodnoy";
  throwInScope: "all" | "neighbor";
  playStyle: "standard" | "abilities";
  allowTransferOnFirstBout?: boolean;
}) {
  return {
    variant: config.variant,
    throwInScope: config.throwInScope,
    playStyle: config.playStyle,
    // Expert-safe default: no transfer until first successful discard.
    allowTransferOnFirstBout: config.allowTransferOnFirstBout ?? false,
  };
}
