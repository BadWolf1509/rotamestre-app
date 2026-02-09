/**
 * Shared styles for nova-entrega screen and FormularioParada component
 */

import { StyleSheet, type Theme } from '@/utils/styles';

export const novaEntregaStyles = StyleSheet.create((theme: Theme) => ({
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  // Content - Mobile (16px padding)
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: '100%',
    marginHorizontal: 'auto',
    width: '100%',
  },
  contentTablet: {
    paddingHorizontal: theme.spacing.lg,
    maxWidth: 960,
  },
  // Tablet container
  tabletContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    maxWidth: 960,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two column layout
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
    width: '100%',
  },
  formColumn: {
    width: '38%',
    maxWidth: 500,
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  // Form - Mobile/Tablet (usado dentro de MobileCard)
  form: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  formDesktop: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  formTablet: {
    marginBottom: 0,
  },
  formMobile: {
    padding: theme.spacing.md,
  },
  formMobileInner: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  // Radio buttons
  radioGroup: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  radioGroupDesktop: {
    gap: theme.desktop.section.gap,
    marginBottom: theme.desktop.field.marginBottom,
  },
  radioButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  radioButtonDesktop: {
    paddingVertical: 6,
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    minHeight: theme.desktop.button.height,
  },
  radioButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radioText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  radioTextDesktop: {
    fontSize: theme.desktop.input.fontSize,
  },
  radioTextActive: {
    color: theme.colors.white,
  },
  radioIcon: {
    marginRight: theme.spacing.xs,
  },
  radioButtonRetirada: {
    borderColor: theme.colors.warning,
  },
  radioButtonRetiradaActive: {
    backgroundColor: theme.colors.warning,
    borderColor: theme.colors.warning,
  },
  radioTextRetirada: {
    color: theme.colors.warning,
  },
  // Vínculo section
  vinculoSection: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.info + '08',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  vinculoSectionDesktop: {
    marginBottom: theme.desktop.field.marginBottom,
    padding: theme.desktop.section.padding,
  },
  vinculoLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  vinculoLabelDesktop: {
    fontSize: theme.desktop.input.fontSize,
    marginBottom: theme.spacing.xs,
  },
  vinculoHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
    lineHeight: theme.spacing.lg,
  },
  vinculoHintDesktop: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.desktop.section.gap,
    lineHeight: theme.typography.fontSize.sm,
  },
  vinculoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  vinculoOptionsDesktop: {
    gap: theme.spacing['1.5'],
  },
  vinculoOption: {
    paddingVertical: theme.spacing['2.5'],
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    minWidth: 100,
    minHeight: 40,
    justifyContent: 'center',
  },
  vinculoOptionDesktop: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.desktop.section.padding,
    minWidth: 80,
    minHeight: 28,
  },
  vinculoOptionActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.info + '15',
  },
  vinculoOptionText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  vinculoOptionTextDesktop: {
    fontSize: theme.typography.fontSize.xs,
  },
  vinculoOptionTextActive: {
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  // Field with label
  fieldWithLabel: {
    marginBottom: theme.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  fieldLabelDesktop: {
    fontSize: theme.desktop.input.fontSize,
  },
  validatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['1'],
    backgroundColor: theme.colors.success + '15',
    paddingHorizontal: theme.spacing['2'],
    paddingVertical: theme.spacing['0.5'],
    borderRadius: theme.borderRadius.sm,
  },
  validatedBadgeDesktop: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  validatedText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.success,
  },
  validatedTextDesktop: {
    fontSize: theme.typography.fontSize.xs,
  },
  // Input
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    minHeight: 48,
    color: theme.colors.gray900,
  },
  inputDesktop: {
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
    marginBottom: theme.desktop.field.marginBottom,
    minHeight: theme.desktop.input.height,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: theme.spacing.sm,
  },
  textAreaDesktop: {
    height: 60,
    paddingVertical: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  errorTextDesktop: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  // Add button
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: theme.spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  addButtonDesktop: {
    paddingVertical: theme.spacing['1.5'],
    paddingHorizontal: theme.spacing.xl,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    minHeight: theme.desktop.button.height,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  addButtonTextDesktop: {
    fontSize: theme.desktop.button.fontSize,
  },
  // Clear button
  clearCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    minHeight: 36,
  },
  clearCardButtonDesktop: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: theme.spacing.xs,
    minHeight: 28,
  },
  clearCardButtonDisabled: {
    opacity: 0.5,
  },
  clearCardButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  clearCardButtonTextDesktop: {
    fontSize: theme.desktop.button.fontSize,
  },
}));
