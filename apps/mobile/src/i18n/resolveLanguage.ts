import { getLocales } from "expo-localization";
import type { AppLanguage, LanguagePreference } from "./languageStorage";

export const SUPPORTED_LANGUAGES: AppLanguage[] = ["en", "ru", "uk"];

/** Map a device language code to a supported app language. */
export function mapDeviceLanguage(code: string | null | undefined): AppLanguage {
  const normalized = (code ?? "").toLowerCase().split("-")[0];
  if (normalized === "ru") return "ru";
  if (normalized === "uk" || normalized === "ua") return "uk";
  return "en";
}

export function deviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode;
    return mapDeviceLanguage(code);
  } catch {
    return "en";
  }
}

/** Resolve preference + device into the active i18n language. */
export function resolveAppLanguage(preference: LanguagePreference): AppLanguage {
  if (preference === "system") return deviceLanguage();
  return preference;
}
