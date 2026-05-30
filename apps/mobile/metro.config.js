// Metro configuration tuned for the pnpm monorepo so the app can import the
// shared @durak/game-core package and resolve native modules from either
// the app or the workspace root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm uses a non-flat layout; let Metro follow symlinks without walking up.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
