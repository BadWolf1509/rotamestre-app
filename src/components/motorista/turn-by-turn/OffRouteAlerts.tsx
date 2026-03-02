import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { withOpacity } from "@/utils/color";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface OffRouteAlertsProps {
  offRouteStatus: "on-route" | "warning" | "critical";
  distanceFromRoute: number;
  isRecalculating: boolean;
  onReroute: () => void;
}

export const OffRouteAlerts = React.memo(function OffRouteAlerts({
  offRouteStatus,
  distanceFromRoute,
  isRecalculating,
  onReroute,
}: OffRouteAlertsProps) {
  const { theme } = useUnistyles();

  if (offRouteStatus === "warning" && !isRecalculating) {
    return (
      <View style={styles.warningBanner}>
        <Ionicons name="warning" size={20} color={theme.colors.warning} />
        <Text style={styles.warningText}>
          Você saiu da rota ({Math.round(distanceFromRoute)}m)
        </Text>
        <TouchableOpacity style={styles.recalculateButton} onPress={onReroute}>
          <Text style={styles.recalculateButtonText}>Recalcular</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (offRouteStatus === "critical" || isRecalculating) {
    return (
      <View style={styles.criticalBanner}>
        <ActivityIndicator size="small" color={theme.colors.white} />
        <Text style={styles.criticalText}>Recalculando rota...</Text>
      </View>
    );
  }

  return null;
});

const styles = StyleSheet.create((theme: Theme) => ({
  warningBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 160 : 140,
    left: theme.spacing["4"],
    right: theme.spacing["4"],
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withOpacity(theme.colors.warning, 0.95),
    paddingHorizontal: theme.spacing["4"],
    paddingVertical: theme.spacing["3"],
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    gap: theme.spacing["3"],
  },
  warningText: {
    flex: 1,
    color: theme.colors.gray900,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: "600",
  },
  recalculateButton: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing["3"],
    paddingVertical: theme.spacing["2"],
    borderRadius: theme.borderRadius.md,
  },
  recalculateButtonText: {
    color: theme.colors.warning,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: "600",
  },
  criticalBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 160 : 140,
    left: theme.spacing["4"],
    right: theme.spacing["4"],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(theme.colors.primary, 0.95),
    paddingHorizontal: theme.spacing["4"],
    paddingVertical: theme.spacing["3"],
    borderRadius: theme.borderRadius.lg,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    gap: theme.spacing["3"],
  },
  criticalText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: "600",
  },
}));
