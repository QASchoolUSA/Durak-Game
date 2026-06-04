import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MenuButton } from "./MenuButton";
import { trigger } from "../feedback/haptics";
import { saveRoomSession } from "../game/onlineSessionStorage";
import { useGameStore } from "../game/store";
import { colors, radius, spacing, typography } from "../theme";
import { useTableTheme } from "../theme/TableThemeContext";
import { useUiTheme } from "../theme/UiThemeContext";

const SPRING_IN = { damping: 26, stiffness: 290, mass: 0.85 };
const SPRING_OUT = { damping: 30, stiffness: 340, mass: 0.75 };
const BACKDROP_FULL = 0.76;

export interface OnlineJoinDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export function OnlineJoinDrawer({ visible, onClose }: OnlineJoinDrawerProps) {
  const ui = useUiTheme();
  const tableTheme = useTableTheme();
  const sheetGradient = tableTheme.backgroundGradient ?? [
    tableTheme.backgroundColor,
    tableTheme.backgroundColor,
  ];
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerH = Math.round(screenH * 0.55);

  const [modalVisible, setModalVisible] = useState(false);
  const prevVisible = useRef(visible);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState(
    () => useGameStore.getState().onlineDisplayName,
  );
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinRoom = useMutation(api.rooms.joinRoom);
  const enterOnlineLobby = useGameStore((s) => s.enterOnlineLobby);
  const setOnlineDisplayName = useGameStore((s) => s.setOnlineDisplayName);

  const ty = useSharedValue(drawerH);
  const backdropO = useSharedValue(0);
  const drawerHSV = useSharedValue(drawerH);
  useEffect(() => { drawerHSV.value = drawerH; }, [drawerH, drawerHSV]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      ty.value = withSpring(drawerH, SPRING_OUT, () => runOnJS(onDone)());
      backdropO.value = withTiming(0, { duration: 220 });
    },
    [drawerH, ty, backdropO],
  );

  const handleClose = useCallback(() => {
    animateOut(() => { setModalVisible(false); onClose(); });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      ty.value = drawerH;
      backdropO.value = 0;
      setModalVisible(true);
      setError(null);
      setDisplayName(useGameStore.getState().onlineDisplayName);
    }
    if (!visible && prevVisible.current && modalVisible) {
      animateOut(() => setModalVisible(false));
    }
    prevVisible.current = visible;
  }, [visible, drawerH, modalVisible, ty, backdropO, animateOut]);

  const onModalShow = useCallback(() => {
    ty.value = withSpring(0, SPRING_IN);
    backdropO.value = withTiming(BACKDROP_FULL, { duration: 280 });
  }, [ty, backdropO]);

  const handleJoin = useCallback(async () => {
    const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
    const name = displayName.trim() || "Player";
    if (trimmedCode.length !== 6) {
      setError("Enter a 6-digit room code");
      return;
    }
    setJoining(true);
    setError(null);
    setOnlineDisplayName(name);
    try {
      const result = await joinRoom({ code: trimmedCode, displayName: name });
      await saveRoomSession({
        roomId: result.roomId,
        sessionToken: result.sessionToken,
        displayName: name,
      });
      trigger("gameStart");
      enterOnlineLobby({
        roomId: result.roomId,
        sessionToken: result.sessionToken,
        displayName: name,
        code: trimmedCode,
        isHost: false,
      });
      setModalVisible(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join room");
      trigger("error");
    } finally {
      setJoining(false);
    }
  }, [code, displayName, joinRoom, enterOnlineLobby, onClose, setOnlineDisplayName]);

  const aBackdrop = useAnimatedStyle(() => ({ opacity: backdropO.value }));
  const aSheet = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={onModalShow}
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, aBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, { height: drawerH }, aSheet]}>
          <LinearGradient
            colors={sheetGradient}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.topAccent, { backgroundColor: ui.panelBorder }]} />

          <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <Text style={[styles.title, { color: ui.accent }]}>JOIN GAME</Text>
            <Text style={[styles.sub, { color: ui.textFaint }]}>
              Enter the room code from your friend
            </Text>

            <Text style={[styles.label, { color: ui.textFaint }]}>YOUR NAME</Text>
            <TextInput
              style={[styles.input, { color: ui.textPrimary, borderColor: ui.panelBorderSoft, backgroundColor: ui.panelBg }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={ui.textFaint}
              maxLength={20}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: ui.textFaint }]}>ROOM CODE</Text>
            <TextInput
              style={[styles.input, styles.codeInput, { color: ui.accent, borderColor: ui.accent, backgroundColor: ui.panelBg }]}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={ui.textFaint}
              keyboardType="number-pad"
              maxLength={6}
            />

            {error && (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            )}

            <MenuButton
              label={joining ? "JOINING…" : "JOIN ROOM"}
              variant="primary"
              icon="▶"
              onPress={handleJoin}
            />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  backdrop: { backgroundColor: "#000" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  topAccent: { height: 1, width: "100%" },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    letterSpacing: 1,
  },
  sub: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.panel,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  codeInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
  },
  error: {
    ...typography.caption,
    textAlign: "center",
  },
});
