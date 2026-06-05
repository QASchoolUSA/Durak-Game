import path from "node:path";
import { load as loadEnv } from "@expo/env";

import appJson from "./app.json";

const monorepoRoot = path.resolve(__dirname, "../..");

// Monorepo keeps `.env` at the repo root; Expo only auto-loads env from apps/mobile.
loadEnv(monorepoRoot);

export default appJson.expo;
