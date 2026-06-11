import { ConvexReactClient } from "convex/react";

// Fallback for builds where env vars were not injected (e.g. EAS profiles
// missing `env`). The URL is public anyway (it ships in the JS bundle), and
// shipping without it crashes every screen that calls a Convex hook.
const FALLBACK_CONVEX_URL = "https://marvelous-marlin-178.convex.cloud";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL || FALLBACK_CONVEX_URL;

export const convexEnabled = Boolean(convexUrl);

export const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;
