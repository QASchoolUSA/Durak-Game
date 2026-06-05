import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getRenderCounts, resetRenderCounts } from "./renderCount";

/** Dev-only FPS + render-count overlay. Toggle via triple-tap top-left corner. */
export function PerfOverlay() {
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [renderSnapshot, setRenderSnapshot] = useState("");
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      lastFrameRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const loop = (now: number) => {
      if (lastFrameRef.current != null) {
        const delta = now - lastFrameRef.current;
        if (delta > 0) {
          const instant = 1000 / delta;
          setFps((prev) => Math.round(prev * 0.85 + instant * 0.15));
        }
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const counts = getRenderCounts();
      const lines = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      setRenderSnapshot(lines || "(no renders)");
    }, 500);
    return () => clearInterval(id);
  }, [visible]);

  if (!__DEV__) return null;

  return (
    <>
      <Pressable
        style={styles.hitTarget}
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel="Toggle perf overlay"
      />
      {visible && (
        <View style={styles.panel} pointerEvents="box-none">
          <Text style={styles.title}>Perf</Text>
          <Text style={styles.row}>UI ~{fps} fps</Text>
          <Text style={styles.subtitle}>Renders (500ms)</Text>
          <Text style={styles.renders}>{renderSnapshot}</Text>
          <Pressable
            onPress={() => {
              resetRenderCounts();
              setRenderSnapshot("(reset)");
            }}
          >
            <Text style={styles.reset}>Reset counts</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    zIndex: 99999,
  },
  panel: {
    position: "absolute",
    top: 52,
    left: 8,
    zIndex: 99999,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 8,
    padding: 10,
    minWidth: 140,
  },
  title: { color: "#7CFFB2", fontWeight: "800", fontSize: 12, marginBottom: 4 },
  row: { color: "#fff", fontSize: 13, fontWeight: "700" },
  subtitle: { color: "#aaa", fontSize: 10, marginTop: 8, marginBottom: 2 },
  renders: { color: "#ddd", fontSize: 10, fontFamily: "Menlo", lineHeight: 14 },
  reset: { color: "#7CFFB2", fontSize: 11, marginTop: 8, fontWeight: "600" },
});
