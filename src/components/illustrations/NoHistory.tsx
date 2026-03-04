/** NoHistory - Empty history illustration: vertical timeline with dots and a clock. */
import { memo } from "react";
import { View } from "react-native";

import { withOpacity } from "@/utils/color";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface IllustrationProps {
  width?: number;
  height?: number;
}

export const NoHistory = memo(function NoHistory({
  width = 160,
  height = 140,
}: IllustrationProps) {
  const { theme } = useUnistyles();
  return (
    <View
      style={[styles.root, { width, height }]}
      accessibilityLabel="Nenhum historico"
    >
      <View
        style={[
          styles.bgCircle,
          { backgroundColor: withOpacity(theme.colors.primary, 0.08) },
        ]}
      />
      {/* Timeline */}
      <View style={styles.timeline}>
        <View
          style={[styles.line, { backgroundColor: theme.colors.gray200 }]}
        />
        <View
          style={[
            styles.dot,
            styles.dot1,
            { backgroundColor: theme.colors.gray300 },
          ]}
        />
        <View
          style={[
            styles.dot,
            styles.dot2,
            { backgroundColor: theme.colors.gray300 },
          ]}
        />
        <View
          style={[
            styles.dot,
            styles.dot3,
            { backgroundColor: theme.colors.gray300 },
          ]}
        />
      </View>
      {/* Clock */}
      <View style={[styles.clock, { borderColor: theme.colors.gray300 }]}>
        <View
          style={[styles.handH, { backgroundColor: theme.colors.gray400 }]}
        />
        <View
          style={[styles.handM, { backgroundColor: theme.colors.gray400 }]}
        />
        <View
          style={[styles.cDot, { backgroundColor: theme.colors.gray400 }]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create((_theme: Theme) => ({
  root: { alignItems: "center", justifyContent: "center" },
  bgCircle: { position: "absolute", width: 70, height: 70, borderRadius: 35 },
  timeline: { position: "absolute", left: 48, top: 28, alignItems: "center" },
  line: { width: 2, height: 80, borderRadius: 1 },
  dot: { position: "absolute", width: 8, height: 8, borderRadius: 4, left: -3 },
  dot1: { top: 4 },
  dot2: { top: 36 },
  dot3: { top: 68 },
  clock: {
    position: "absolute",
    right: 32,
    top: 40,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  handH: {
    position: "absolute",
    width: 14,
    height: 2,
    borderRadius: 1,
    top: 23,
    left: 23,
  },
  handM: {
    position: "absolute",
    width: 2,
    height: 16,
    borderRadius: 1,
    top: 8,
    left: 23,
  },
  cDot: { position: "absolute", width: 4, height: 4, borderRadius: 2 },
}));
