// Metro configuration tuned for the pnpm monorepo so the app can import the
// shared @durak/game-core package and resolve native modules from either
// the app or the workspace root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

function resolvePkg(name) {
  try {
    return path.dirname(
      require.resolve(`${name}/package.json`, {
        paths: [projectRoot, workspaceRoot],
      }),
    );
  } catch {
    return path.join(workspaceRoot, "node_modules", name);
  }
}

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm uses a non-flat layout; let Metro follow symlinks without walking up.
config.resolver.disableHierarchicalLookup = true;
// Pin singletons so lazy chunks share one React / Convex / Reanimated instance.
config.resolver.extraNodeModules = {
  convex: resolvePkg("convex"),
  react: resolvePkg("react"),
  "react-native": resolvePkg("react-native"),
  "react-native-reanimated": resolvePkg("react-native-reanimated"),
  "react-native-worklets": resolvePkg("react-native-worklets"),
  "react-native-gesture-handler": resolvePkg("react-native-gesture-handler"),
  "react-native-svg": resolvePkg("react-native-svg"),
};

module.exports = config;
