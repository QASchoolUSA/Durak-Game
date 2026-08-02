module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-adds react-native-worklets/plugin when the
    // package is installed — do not list it again (double-transform breaks
    // shared-value serialization and aborts Expo Go on the UI runtime).
    presets: ["babel-preset-expo"],
  };
};
