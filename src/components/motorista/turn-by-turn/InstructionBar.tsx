import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Text, View } from "react-native";

import type { NavigationInstruction } from "@/services/turnByTurnNavigation";
import type { IconName } from "@/types/icons";
import { withOpacity } from "@/utils/color";
import { StyleSheet, useUnistyles, type Theme } from "@/utils/styles";

interface InstructionBarProps {
  currentInstruction: NavigationInstruction | null;
  nextInstruction: NavigationInstruction | null;
  formattedDistanceToTurn: string;
  getManeuverIcon: (maneuver: string) => IconName;
}

export const InstructionBar = React.memo(function InstructionBar({
  currentInstruction,
  nextInstruction,
  formattedDistanceToTurn,
  getManeuverIcon,
}: InstructionBarProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.instructionBar}>
      <View style={styles.instructionContent}>
        <View style={styles.maneuverIcon}>
          <Ionicons
            name={getManeuverIcon(currentInstruction?.maneuver || "")}
            size={40}
            color={theme.colors.white}
          />
        </View>

        <View style={styles.instructionText}>
          <Text style={styles.distanceText}>{formattedDistanceToTurn}</Text>
          <Text style={styles.instructionMainText} numberOfLines={2}>
            {currentInstruction?.instruction || "Calculando..."}
          </Text>
        </View>
      </View>

      {nextInstruction && (
        <View style={styles.nextInstructionBar}>
          <Ionicons
            name={getManeuverIcon(nextInstruction.maneuver)}
            size={16}
            color={theme.colors.gray400}
          />
          <Text style={styles.nextInstructionText}>
            Depois: {nextInstruction.instruction}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create((theme: Theme) => ({
  instructionBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.select({ ios: 50, web: 20, default: 30 }) as number,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  instructionContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing["4"],
    paddingVertical: theme.spacing["4"],
  },
  maneuverIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: withOpacity(theme.colors.white, 0.2),
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing["4"],
  },
  instructionText: {
    flex: 1,
  },
  distanceText: {
    fontSize: theme.typography.fontSize["2xl"],
    fontWeight: "700",
    color: theme.colors.white,
    marginBottom: theme.spacing["1"],
  },
  instructionMainText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.white,
    opacity: 0.95,
  },
  nextInstructionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing["4"],
    paddingVertical: theme.spacing["2"],
    backgroundColor: withOpacity(theme.colors.black, 0.1),
    borderTopWidth: 1,
    borderTopColor: withOpacity(theme.colors.white, 0.1),
  },
  nextInstructionText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray200,
    marginLeft: theme.spacing["2"],
  },
}));
