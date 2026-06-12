import { ConvexReactClient } from "convex/react";

// Fallback for Vercel deployment where env vars are not set during build/run yet,
// or for simple out-of-the-box local testing.
const FALLBACK_CONVEX_URL = "https://marvelous-marlin-178.convex.cloud";

const convexUrl = (import.meta.env.VITE_CONVEX_URL as string) || FALLBACK_CONVEX_URL;

export const convexEnabled = Boolean(convexUrl);

export const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;
