/**
 * Estilos da tela de Motoristas (Gestor)
 * Extraídos para melhor manutenibilidade
 */

import { withOpacity } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

export const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  tableCellText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  topSection: {
    marginBottom: theme.spacing.lg,
  },
  infoBox: {
    backgroundColor: theme.colors.info + '10',
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  infoText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
    textAlign: 'center',
  },
  addButtonMobile: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  emptyContainer: {
    padding: theme.spacing['6xl'] - 4,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: theme.spacing['6xl'],
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  motoristaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  motoristaCardInativo: {
    opacity: 0.6,
  },
  motoristaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  motoristaHeaderLeft: {
    flex: 1,
  },
  motoristaNome: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  motoristaEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  motoristaTelefone: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm - 2,
    borderRadius: theme.borderRadius.lg,
  },
  statusBadgeAtivo: {
    backgroundColor: theme.colors.successBg,
  },
  statusBadgeInativo: {
    backgroundColor: theme.colors.errorBg,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  acoesContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  botaoEditar: {
    flex: 1,
    backgroundColor: theme.colors.info,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  botaoEditarText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  botaoStatus: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  botaoDesativar: {
    backgroundColor: theme.colors.error,
  },
  botaoAtivar: {
    backgroundColor: theme.colors.success,
  },
  botaoStatusText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  dataCadastro: {
    fontSize: theme.typography.fontSize.xs - 1,
    color: theme.colors.gray400,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Form field styles (seguindo padrão AddStopModal)
  field: {
    marginBottom: theme.spacing.lg,
  },
  fieldCompact: {
    marginBottom: theme.desktop.field.marginBottom,
  },
  label: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  labelCompact: {
    fontSize: theme.desktop.input.fontSize,
    marginBottom: theme.spacing.xs,
  },
  // Legacy inputLabel (para compatibilidade)
  inputLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
  },
  inputCompact: {
    height: theme.desktop.input.height,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
  },
  inputError: {
    borderColor: theme.colors.error,
    borderWidth: 2,
    backgroundColor: theme.colors.red50,
  },
  inputDisabledStyle: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.gray500,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primaryDark,
    padding: theme.spacing.sm + 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withOpacity(theme.colors.black, 0.5),
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['2xl'],
    width: '100%',
    maxWidth: 600,
    minWidth: 400,
    maxHeight: '85vh',
    ...theme.shadows.lg,
  },
  modalTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  helperText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  helperTextCompact: {
    fontSize: theme.typography.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['2xl'],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.gray100,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
  headerStats: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    alignItems: 'flex-end',
  },
  headerStat: {
    alignItems: 'flex-end',
  },
  headerStatValue: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  headerStatValueSuccess: {
    color: theme.colors.success,
  },
  headerStatLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xl,
    flexWrap: 'wrap',
  },
  cardAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
  },
  cardAddButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.sm,
  },
  // Avatar styles
  avatarCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: theme.components.avatar.size.md,
    height: theme.components.avatar.size.md,
    borderRadius: theme.components.avatar.size.md / 2,
  },
  avatarPlaceholder: {
    width: theme.components.avatar.size.md,
    height: theme.components.avatar.size.md,
    borderRadius: theme.components.avatar.size.md / 2,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansBold,
  },
}));
