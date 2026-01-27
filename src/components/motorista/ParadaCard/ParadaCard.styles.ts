/**
 * ParadaCard Styles - Centralized styles for ParadaCard components
 */

import { boxShadow, textShadow, withOpacity } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

export const styles = StyleSheet.create((theme: Theme) => ({
  // Card base styles
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    ...theme.shadows.md,
  },
  paradaCardProxima: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.primaryBg,
    marginTop: 12,
  },
  paradaCardConcluida: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successBg,
  },
  paradaCardPulada: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBg,
    opacity: 0.7,
  },

  // Proxima badge
  proximaBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    zIndex: 1,
  },
  proximaBadgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs - 2,
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.5,
  },

  // Header styles
  paradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  ordemBadge: {
    width: theme.spacing.xl,
    height: theme.spacing.xl,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ordemText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansBold,
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
    flex: 1,
  },
  statusBadgePendente: {
    backgroundColor: theme.colors.yellow100,
  },
  statusBadgeEmAndamento: {
    backgroundColor: theme.colors.infoBg,
  },
  statusBadgeConcluida: {
    backgroundColor: theme.colors.green100,
  },
  statusBadgePulada: {
    backgroundColor: theme.colors.red100,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },

  // Tipo badge
  tipoBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
  },
  tipoBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tipoBadgeEntrega: {
    backgroundColor: theme.colors.blue100,
  },
  tipoBadgeRetirada: {
    backgroundColor: theme.colors.indigo100,
  },
  tipoBadgeOrigem: {
    backgroundColor: theme.colors.gray100,
  },
  tipoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },

  // Address styles
  paradaEndereco: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  paradaEnderecoResumo: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 0,
  },
  paradaEnderecoSecundario: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
    marginBottom: 0,
  },
  enderecoResumo: {
    marginBottom: theme.spacing.xs,
  },
  paradaEnderecoCompacto: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: 0,
    flex: 1,
  },
  enderecoExpandivel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },

  // Details styles
  paradaDetalhes: {
    marginBottom: theme.spacing.xs,
  },
  paradaDetalheTexto: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  telefoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  telefoneLinkTexto: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.info,
    textDecorationLine: 'underline',
  },

  // Observacoes styles
  observacoesContainer: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  observacoesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  observacoesLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
  },
  observacoesTexto: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontStyle: 'italic',
  },

  // Completion time
  paradaHorarioResumo: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },

  // Button styles
  botaoDisabled: {
    opacity: 0.6,
  },
  retornarContainer: {
    marginTop: theme.spacing.sm,
  },
  botaoRetomar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.info,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  botaoRetomarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Primary actions
  primaryActionsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  botaoNavegar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.md - 4,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    shadowColor: theme.colors.secondaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: boxShadow(0, 4, 16, 0, theme.colors.secondaryDark, 0.35),
  },
  botaoNavegarIcone: {
    fontSize: theme.typography.fontSize.xl,
  },
  botaoNavegarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    textShadowColor: withOpacity(theme.colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textShadow: textShadow(0, 1, 2, theme.colors.black, 0.25),
  },
  botaoReportar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.md - 4,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    shadowColor: theme.colors.warningDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    boxShadow: boxShadow(0, 4, 16, 0, theme.colors.warningDark, 0.35),
  },
  botaoReportarTexto: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    textShadowColor: withOpacity(theme.colors.black, 0.3),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textShadow: textShadow(0, 1, 2, theme.colors.black, 0.3),
  },

  // Swipe hint
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  swipeHintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
