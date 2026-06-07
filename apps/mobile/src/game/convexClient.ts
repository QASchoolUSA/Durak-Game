import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

export const convexEnabled = Boolean(convexUrl);

export const convex = convexUrl
  ? new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })
  : null;
