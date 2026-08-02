import Constants, { ExecutionEnvironment } from "expo-constants";

/** Expo Go aborts on unhandled UI-worklet errors; prefer static UI there. */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
