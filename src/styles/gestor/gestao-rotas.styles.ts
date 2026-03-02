/**
 * Estilos da tela de Gestão de Rotas (Gestor)
 * Extraídos para melhor manutenibilidade
 */

import { StyleSheet, type Theme } from "@/utils/styles";

export const styles = StyleSheet.create((theme: Theme) => ({
  tableSection: {
    marginTop: theme.spacing["2xl"],
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: "auto",
    width: "100%",
  },
  searchContainer: {
    marginBottom: theme.spacing.lg,
  },
  searchInput: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    minHeight: 48,
  },
  searchInputDesktop: {
    paddingVertical: 0,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    fontSize: theme.desktop.input.fontSize,
    minHeight: theme.desktop.input.height,
  },
  filtrosLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.lg,
  },
  filtrosButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: theme.spacing["3xl"],
  },
  emptyStateText: {
    fontSize: 48,
    marginBottom: theme.spacing["2xl"],
  },
  emptyStateTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.xl,
  },
  headerStat: {
    alignItems: "flex-end",
  },
  headerStatValue: {
    fontSize: theme.typography["2xl"],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  headerStatValueSuccess: {
    color: theme.colors.success,
  },
  headerStatValueWarning: {
    color: theme.colors.warning,
  },
  headerStatLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing.lg,
  },
  cardHeaderButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  cardHeaderButtonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
  },
  cardHeaderButtonPrimaryText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  cardHeaderButtonSecondary: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
  },
  cardHeaderButtonSecondaryText: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  tableCellText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
  mobileActionsRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  mobileActionButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
  },
  mobileActionButtonPrimaryText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  mobileActionButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: "center",
  },
  mobileActionButtonSecondaryText: {
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
}));
