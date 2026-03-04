/** NoRoutes - Empty routes illustration: road with two pin markers. */
import { memo } from "react";
import { View } from "react-native";

import { withOpacity } from "@/utils/color";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface IllustrationProps {
  width?: number;
  height?: number;
}

export const NoRoutes = memo(function NoRoutes({
  width = 160,
  height = 140,
}: IllustrationProps) {
  const { theme } = useUnistyles();
  const bg = withOpacity(theme.colors.primary, 0.1);
  return (
    <View
      style={[styles.root, { width, height }]}
      accessibilityLabel="Nenhuma rota"
    >
      <View style={[styles.bgCircle, { backgroundColor: bg }]} />
      <View style={[styles.road, { borderColor: theme.colors.gray300 }]} />
      <View style={styles.markerLeft}>
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
        <View
          style={[styles.stem, { backgroundColor: theme.colors.primary }]}
        />
      </View>
      <View style={styles.markerRight}>
        <View
          style={[styles.dot, { backgroundColor: theme.colors.secondary }]}
        />
        <View
          style={[styles.stem, { backgroundColor: theme.colors.secondary }]}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create((_theme: Theme) => ({
  root: { alignItems: "center", justifyContent: "center" },
  bgCircle: { position: "absolute", width: 80, height: 80, borderRadius: 40 },
  road: {
    width: 120,
    height: 4,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 2,
  },
  markerLeft: { position: "absolute", left: 28, top: 38, alignItems: "center" },
  markerRight: {
    position: "absolute",
    right: 28,
    top: 38,
    alignItems: "center",
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  stem: { width: 2, height: 20 },
}));
