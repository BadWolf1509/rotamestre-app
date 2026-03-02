/**
 * Estilos da tela de Reset Password
 * Extraídos para melhor manutenibilidade
 */

import { StyleSheet, type Theme } from "@/utils/styles";

export const styles = StyleSheet.create((theme: Theme) => ({
  containerDesktop: {
    flex: 1,
    flexDirection: "row",
  },
  leftPanel: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing["16"],
  },
  formContainerDesktop: {
    width: "100%",
    maxWidth: 480,
  },
  headerDesktop: {
    marginBottom: theme.spacing["10"],
  },
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize["3xl"],
    color: theme.colors.gray900,
    marginBottom: theme.spacing["2.5"],
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    lineHeight: theme.spacing.xxl,
  },
  inputGroup: {
    marginBottom: theme.spacing.xxl,
  },
  inputLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    marginBottom: theme.spacing["2"],
  },
  passwordContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
  },
  inputDesktopPassword: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing["3.5"],
    paddingRight: 45,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  eyeButton: {
    position: "absolute",
    right: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing["2"],
    ...theme.shadows.md,
  },
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.white,
    justifyContent: "center",
    padding: theme.spacing.xxl,
  },
  header: {
    alignItems: "center",
    marginBottom: theme.spacing["10"],
  },
  logoHorizontal: {
    marginBottom: theme.spacing.xl,
  },
  logoImage: {
    width: 280,
    height: 115,
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray600,
    textAlign: "center",
  },
  form: {
    width: "100%",
    gap: theme.spacing.lg,
  },
  inputPassword: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    paddingRight: 45,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  backButton: {
    alignItems: "center",
    padding: theme.spacing.md,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
  },
  checkingContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
  },
  checkingText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  expiredContainer: {
    alignItems: "center",
  },
  expiredTitle: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize["2xl"],
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
    textAlign: "center",
  },
  expiredMessage: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    textAlign: "center",
    lineHeight: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
  },
  mismatchText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  requirementsBox: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  requirementsTitle: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  requirementText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.xs,
  },
}));
