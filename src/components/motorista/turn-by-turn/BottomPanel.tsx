import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";

import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface BottomPanelProps {
  progress: number;
  formattedRemainingDistance: string;
  formattedRemainingTime: string;
  speed: number;
  voiceEnabled: boolean;
  mapView?: "north-up" | "heading-up";
  onToggleVoice: () => void;
  onToggleMapView?: () => void;
  onOpenInMaps?: () => void;
  onExit: () => void;
}

export const BottomPanel = React.memo(function BottomPanel({
  progress,
  formattedRemainingDistance,
  formattedRemainingTime,
  speed,
  voiceEnabled,
  mapView,
  onToggleVoice,
  onToggleMapView,
  onOpenInMaps,
  onExit,
}: BottomPanelProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.bottomPanel}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formattedRemainingDistance}</Text>
          <Text style={styles.statLabel}>restante</Text>
        </View>

        <View style={styles.statSeparator} />

        <View style={styles.stat}>
          <Text style={styles.statValue}>{formattedRemainingTime}</Text>
          <Text style={styles.statLabel}>chegada</Text>
        </View>

        <View style={styles.statSeparator} />

        <View style={styles.stat}>
          <Text style={styles.statValue}>{speed}</Text>
          <Text style={styles.statLabel}>km/h</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            !voiceEnabled && styles.controlButtonDisabled,
          ]}
          onPress={onToggleVoice}
        >
          <Ionicons
            name={voiceEnabled ? "volume-high" : "volume-mute"}
            size={24}
            color={voiceEnabled ? theme.colors.primary : theme.colors.gray400}
          />
        </TouchableOpacity>

        {onOpenInMaps && (
          <TouchableOpacity
            style={styles.openMapsButton}
            onPress={onOpenInMaps}
          >
            <Ionicons name="navigate" size={20} color={theme.colors.white} />
            <Text style={styles.openMapsButtonText}>Google Maps</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.exitButton} onPress={onExit}>
          <Ionicons name="close" size={24} color={theme.colors.white} />
          <Text style={styles.exitButtonText}>Sair</Text>
        </TouchableOpacity>

        {onToggleMapView && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={onToggleMapView}
          >
            <Ionicons
              name={mapView === "heading-up" ? "compass" : "navigate"}
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: Platform.select({ ios: 30, default: 20 }) as number,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.success,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: theme.spacing["4"],
    paddingHorizontal: theme.spacing["4"],
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: "700",
    color: theme.colors.gray900,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing["0.5"],
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.gray200,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing["4"],
    paddingTop: theme.spacing["2"],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    gap: theme.spacing["3"],
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  openMapsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.info,
    paddingVertical: theme.spacing["3"],
    borderRadius: theme.borderRadius["3xl"],
    gap: theme.spacing["2"],
  },
  openMapsButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: "600",
  },
  exitButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing["6"],
    paddingVertical: theme.spacing["3"],
    borderRadius: theme.borderRadius["3xl"],
    gap: theme.spacing["2"],
  },
  exitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: "600",
  },
}));
