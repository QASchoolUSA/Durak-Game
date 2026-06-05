export function onlineRules(config: {
  variant: "podkidnoy" | "perevodnoy";
  throwInScope: "all" | "neighbor";
  playStyle: "standard" | "abilities";
}) {
  return {
    variant: config.variant,
    throwInScope: config.throwInScope,
    playStyle: config.playStyle,
  };
}
