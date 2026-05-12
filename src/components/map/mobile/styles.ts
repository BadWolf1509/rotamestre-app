/**
 * Shared styles for MapaMobile and its extracted sub-components.
 *
 * Uses Unistyles StyleSheet.create with theme callback so tokens
 * are applied once and memoized by the runtime.
 */

import { withOpacity } from "@/utils/color";
import { StyleSheet, type Theme } from "@/utils/styles";

export const mapMobileStyles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    minHeight: 300,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.disabled,
  },
  map: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 300,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.disabled,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing["5"],
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  markerContainer: {
    width: theme.components.minTouchTarget,
    height: theme.components.minTouchTarget,
    borderRadius: theme.components.minTouchTarget / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: theme.colors.surface,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerWrapper: {
    alignItems: "center",
  },
  calloutWrapper: {
    marginBottom: theme.spacing["2"],
  },
  // Checkpoint compact blue marker - distinct icons for PARTIDA/CHEGADA
  checkpointMarkerCompact: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    borderBottomLeftRadius: theme.spacing["0.5"],
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: theme.spacing["0.5"],
    borderColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Callout for checkpoint
  checkpointCalloutContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing["3"],
    minWidth: 180,
    maxWidth: 240,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkpointCalloutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2"],
    marginBottom: theme.spacing["2"],
  },
  checkpointIconBadge: {
    width: theme.spacing["6"],
    height: theme.spacing["6"],
    borderRadius: theme.borderRadius.xs + 2,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkpointCalloutTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: "700",
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  checkpointCalloutUnidade: {
    fontSize: theme.typography.sm, // 14px
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: theme.spacing["1"],
  },
  checkpointCalloutAddress: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
    paddingVertical: theme.spacing["2"],
    paddingHorizontal: theme.spacing["3"],
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    marginTop: theme.spacing["2.5"],
  },
  copyButtonText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  markerText: {
    color: theme.colors.surface,
    fontSize: theme.typography.fontSize.base,
    fontWeight: "bold",
  },
  markerSelected: {
    borderWidth: theme.spacing["1"],
    borderColor: theme.colors.primary,
    transform: [{ scale: 1.1 }],
  },
  markerPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.8,
  },
  calloutContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing["3"],
    minWidth: 200,
    maxWidth: 280,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: "bold",
    color: theme.colors.text,
    marginBottom: theme.spacing["1"],
  },
  calloutAddress: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing["2"],
    lineHeight: 18,
  },
  calloutDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
    marginBottom: theme.spacing["1.5"],
  },
  calloutDetailText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.textSecondary,
    flex: 1,
  },
  calloutPhoneText: {
    fontSize: theme.typography.sm, // 14px
    color: theme.colors.primary,
    fontWeight: "500",
  },
  calloutBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["2"],
    marginTop: theme.spacing["1"],
    flexWrap: "wrap",
  },
  calloutStatus: {
    paddingHorizontal: theme.spacing["2.5"],
    paddingVertical: theme.spacing["1"],
    borderRadius: theme.borderRadius.lg,
  },
  calloutStatusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
  },
  calloutTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1"],
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing["2"],
    paddingVertical: theme.spacing["1"],
    borderRadius: theme.borderRadius.lg,
  },
  calloutTypeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  infoBadge: {
    position: "absolute",
    top: theme.spacing["2.5"],
    right: theme.spacing["2.5"],
    backgroundColor: withOpacity(theme.colors.white, 0.95),
    paddingHorizontal: theme.spacing["3"],
    paddingVertical: theme.spacing["1.5"],
    borderRadius: theme.spacing["5"],
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoBadgeLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing["1.5"],
  },
  infoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: "600",
    color: theme.colors.text,
  },
  fabContainer: {
    position: "absolute",
    bottom: theme.spacing["5"],
    right: theme.spacing["4"],
    gap: theme.spacing["3"],
  },
  fabPrimary: {
    width: theme.spacing["14"],
    height: theme.spacing["14"],
    borderRadius: theme.spacing["7"],
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabSecondary: {
    width: theme.components.minTouchTarget,
    height: theme.components.minTouchTarget,
    borderRadius: theme.components.minTouchTarget / 2,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
}));
