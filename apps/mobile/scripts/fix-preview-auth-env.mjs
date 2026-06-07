#!/usr/bin/env node
/**
 * Regenerate JWT_PRIVATE_KEY + JWKS on the preview deployment.
 * Fixes "Auth provider discovery failed" when JWKS was stored with bad escaping.
 *
 * Usage (from repo root): pnpm --filter @durak/mobile fix:auth-env
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const PREVIEW_DEPLOYMENT = "neighborly-blackbird-943";
const SITE_URL = `https://${PREVIEW_DEPLOYMENT}.convex.site`;
const mobileRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: mobileRoot, stdio: "inherit", ...opts });
}

async function generateKeys() {
  const keys = await generateKeyPair("RS256");
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  return {
    JWT_PRIVATE_KEY: `${privateKey.trimEnd().replace(/\n/g, " ")}`,
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicKey }] }),
  };
}

const { JWT_PRIVATE_KEY, JWKS } = await generateKeys();

const jwksPath = join(tmpdir(), `durak-jwks-${Date.now()}.json`);
const keyPath = join(tmpdir(), `durak-jwt-key-${Date.now()}.txt`);
writeFileSync(jwksPath, JWKS);
writeFileSync(keyPath, JWT_PRIVATE_KEY);

try {
  run(
    `pnpm exec convex env set JWKS --deployment ${PREVIEW_DEPLOYMENT} --from-file "${jwksPath}" --force`,
  );
  run(
    `pnpm exec convex env set JWT_PRIVATE_KEY --deployment ${PREVIEW_DEPLOYMENT} --from-file "${keyPath}" --force`,
  );
  run(
    `pnpm exec convex env set SITE_URL --deployment ${PREVIEW_DEPLOYMENT} "${SITE_URL}" --force`,
  );
  run("pnpm exec convex deploy --preview-name dev");
  console.log("\nDone. Restart Expo (pnpm mobile:clear) and try With friends again.");
} finally {
  unlinkSync(jwksPath);
  unlinkSync(keyPath);
}
