import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "./i18n";
import { mapDeviceLanguage, resolveAppLanguage } from "./resolveLanguage";
import { seatRoleTag } from "../game/selectors";

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

describe("mapDeviceLanguage", () => {
  it("maps supported codes and falls back to en", () => {
    expect(mapDeviceLanguage("ru")).toBe("ru");
    expect(mapDeviceLanguage("uk")).toBe("uk");
    expect(mapDeviceLanguage("ua")).toBe("uk");
    expect(mapDeviceLanguage("en")).toBe("en");
    expect(mapDeviceLanguage("fr")).toBe("en");
  });
});

describe("resolveAppLanguage", () => {
  it("honors explicit preferences", () => {
    expect(resolveAppLanguage("ru")).toBe("ru");
    expect(resolveAppLanguage("uk")).toBe("uk");
    expect(resolveAppLanguage("en")).toBe("en");
  });
});

describe("locale packs", () => {
  it("translates role tags in en, ru, and uk", async () => {
    await i18n.changeLanguage("en");
    expect(seatRoleTag("attacker")?.label).toBe("ATTACK");
    expect(i18n.t("game.status.yourAttack")).toBe("Your turn — attack");

    await i18n.changeLanguage("ru");
    expect(seatRoleTag("attacker")?.label).toBe("АТАКА");
    expect(seatRoleTag("taking")?.label).toBe("БЕРУ");
    expect(i18n.t("game.status.yourAttack")).toBe("Ваш ход — атакуйте");

    await i18n.changeLanguage("uk");
    expect(seatRoleTag("defender")?.label).toBe("ЗАХИСТ");
    expect(seatRoleTag("taking")?.label).toBe("БЕРУ");
    expect(i18n.t("game.status.yourAttack")).toBe("Ваш хід — атакуйте");

    await i18n.changeLanguage("en");
  });

  it("keeps English mode names and localizes RU/UK", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("config.podkidnoy")).toBe("Podkidnoy");
    expect(i18n.t("config.perevodnoy")).toBe("Perevodnoy");

    await i18n.changeLanguage("ru");
    expect(i18n.t("config.podkidnoy")).toBe("Подкидной");
    expect(i18n.t("config.perevodnoy")).toBe("Переводной");

    await i18n.changeLanguage("uk");
    expect(i18n.t("config.podkidnoy")).toBe("Підкидний");
    expect(i18n.t("config.perevodnoy")).toBe("Перевідний");

    await i18n.changeLanguage("en");
  });

  it("provides account deletion copy in en, ru, and uk", async () => {
    for (const lang of ["en", "ru", "uk"]) {
      await i18n.changeLanguage(lang);
      expect(i18n.t("settings.account.deleteAccount")).toBeTruthy();
      expect(i18n.t("settings.account.deleteTitle")).toBeTruthy();
      expect(i18n.t("settings.account.deleteBody")).toBeTruthy();
      expect(i18n.t("settings.account.deleteConfirm")).toBeTruthy();
    }
    await i18n.changeLanguage("en");
  });
});

