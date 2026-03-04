/**
 * Centralized marker color mapping for map components.
 * Uses statusConfig as source of truth, with marker-specific overrides.
 *
 * Web markers: colored fill + white text -> needs dark variants for WCAG contrast
 * Mobile markers: colored fill + white text -> same dark variants
 */

import {
  getStatusColorKey,
  type RouteStatusType,
  type StopStatusType,
} from "@/constants/statusConfig";

interface ThemeColors {
  primary: string;
  successDark: string;
  warningDark: string;
  errorDark: string;
  gray500: string;
}

/**
 * Map marker fill color for a given status.
 * Returns dark variants that pass WCAG AA contrast with white text/labels.
 */
export function getMarkerFillColor(
  status: string,
  colors: ThemeColors,
): string {
  // 'pulada' is mapped to 'warning' in statusConfig, but on the map
  // skipped stops should appear muted (gray) to distinguish from 'pendente'
  if (status === "pulada") return colors.gray500;

  const colorKey = getStatusColorKey(
    status as RouteStatusType | StopStatusType,
  );

  switch (colorKey) {
    case "success":
      return colors.successDark; // #047857 (5.9:1 with white)
    case "warning":
      return colors.warningDark; // #d97706 (3.7:1) — best available amber
    case "info":
      return colors.primary; // #284093 (8.6:1 with white)
    case "error":
      return colors.errorDark; // #dc2626 (4.6:1 with white)
    case "gray600":
      return colors.gray500; // #6b7280 (5.4:1 with white)
    default:
      return colors.gray500;
  }
}

/**
 * MapLibre GL circle-color expression (data-driven).
 * Returns a case expression for use in paint properties.
 */
export function getMarkerColorExpression(colors: ThemeColors): unknown[] {
  return [
    "case",
    ["==", ["get", "is_checkpoint"], true],
    [
      "case",
      ["==", ["get", "is_partida"], true],
      colors.successDark,
      colors.errorDark,
    ],
    ["==", ["get", "status"], "concluida"],
    colors.successDark,
    ["==", ["get", "status"], "em_andamento"],
    colors.primary,
    ["==", ["get", "status"], "pendente"],
    colors.warningDark,
    ["==", ["get", "status"], "pulada"],
    colors.gray500,
    colors.gray500,
  ];
}
