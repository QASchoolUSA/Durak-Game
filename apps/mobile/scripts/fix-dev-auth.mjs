import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

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
  run(`npx convex env set JWKS --from-file "${jwksPath}" --force`);
  run(`npx convex env set JWT_PRIVATE_KEY --from-file "${keyPath}" --force`);
  console.log("\\nDone!");
} finally {
  unlinkSync(jwksPath);
  unlinkSync(keyPath);
}
