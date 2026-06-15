import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const isAppIconSupported = Platform.OS === "ios" && !isExpoGo;

let setAppIcon: ((name: string | null) => Promise<any>) | null = null;
let getAppIcon: (() => Promise<string | null>) | null = null;

if (isAppIconSupported) {
  try {
    const module = require("@howincodes/expo-dynamic-app-icon");
    setAppIcon = module.setAppIcon;
    getAppIcon = module.getAppIcon;
  } catch (error) {
    console.warn("Failed to load expo-dynamic-app-icon:", error);
  }
}
import { useUiTheme } from "../theme/UiThemeContext";
import { colors, radius, spacing, typography } from "../theme";

const ICON_PRESETS = [
  {
    id: "default",
    name: "Default",
    previewLight: require("../../assets/ios-icon-light.png"),
    previewDark: require("../../assets/ios-icon-dark.png"),
  },
  {
    id: "glass",
    name: "Liquid Glass",
    previewLight: require("../../assets/ios-icon-glass-light.png"),
    previewDark: require("../../assets/ios-icon-glass-dark.png"),
  },
  {
    id: "tinted",
    name: "Tinted",
    previewLight: require("../../assets/ios-icon-tinted-light.png"),
    previewDark: require("../../assets/ios-icon-tinted-dark.png"),
  },
] as const;

type IconId = typeof ICON_PRESETS[number]["id"];

export function AppIconPicker() {
  const ui = useUiTheme();
  const [selectedIcon, setSelectedIcon] = useState<IconId>("default");

  useEffect(() => {
    async function loadActiveIcon() {
      if (!isAppIconSupported || !getAppIcon) return;
      try {
        const active = await getAppIcon();
        if (active === "glass") {
          setSelectedIcon("glass");
        } else if (active === "tinted") {
          setSelectedIcon("tinted");
        } else {
          setSelectedIcon("default");
        }
      } catch (error) {
        console.warn("Error getting current app icon:", error);
      }
    }
    void loadActiveIcon();
  }, []);

  const handleSelectIcon = async (id: IconId) => {
    if (id === selectedIcon) return;
    setSelectedIcon(id);

    if (!isAppIconSupported || !setAppIcon) return;
    try {
      if (id === "default") {
        await setAppIcon(null);
      } else {
        await setAppIcon(id);
      }
    } catch (error) {
      console.error("Failed to set app icon:", error);
    }
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ICON_PRESETS.map((icon) => {
          const isSelected = selectedIcon === icon.id;
          return (
            <Pressable
              key={icon.id}
              onPress={() => void handleSelectIcon(icon.id)}
              style={[
                styles.tile,
                isSelected && {
                  borderColor: ui.accent,
                  backgroundColor: ui.accentSoft,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${icon.name} app icon`}
            >
              <View style={styles.previewStack}>
                {/* Dark Icon Preview (Back) */}
                <Image
                  source={icon.previewDark}
                  style={[styles.iconPreview, styles.previewDark]}
                />
                {/* Light Icon Preview (Front) */}
                <Image
                  source={icon.previewLight}
                  style={[styles.iconPreview, styles.previewLight]}
                />
              </View>
              <Text
                style={[
                  styles.tileName,
                  { color: isSelected ? ui.accent : ui.textMuted },
                ]}
              >
                {icon.name}
              </Text>
              {isSelected && (
                <View style={[styles.selectedDot, { backgroundColor: ui.accent }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.hint, { color: ui.textFaint }]}>
        Choose your homescreen app icon style (iOS only)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.sm,
    paddingHorizontal: 2,
    paddingVertical: spacing.sm,
  },
  tile: {
    width: 100,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm + 4,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  previewStack: {
    width: 72,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: spacing.xs,
  },
  iconPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: "absolute",
  },
  previewDark: {
    top: 4,
    left: 8,
    zIndex: 1,
    opacity: 0.85,
  },
  previewLight: {
    bottom: 4,
    right: 8,
    zIndex: 2,
  },
  tileName: {
    ...typography.caption,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.xs,
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
    marginLeft: 4,
  },
});
