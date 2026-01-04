/**
 * Estilos da tela de Incidentes (Gestor)
 * Extraídos para melhor manutenibilidade
 */

import { StyleSheet, type Theme } from '@/utils/styles';

export const styles = StyleSheet.create((theme: Theme) => ({
  // Filtros
  filtrosContainer: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  filtroGroup: {
    gap: theme.spacing.sm,
  },
  filtroLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  filtroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  // Table
  tableCellText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
  categoriaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Mobile
  mobileContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  mobileCategoriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  mobileCategoriaText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  mobileMotorista: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  mobileEnderecoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  mobileEndereco: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },
  mobileData: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  mobileActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  mobileActionText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },

  // Modal de detalhes
  detalhesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  detalhesHeaderCompact: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  detalhesCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detalhesCategoriaText: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  detalhesCategoriaTextCompact: {
    fontSize: theme.typography.base,
  },
  detalhesSection: {
    marginBottom: theme.spacing.lg,
  },
  detalhesSectionCompact: {
    marginBottom: theme.spacing.md,
  },
  detalhesLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  detalhesLabelCompact: {
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.xs,
  },
  detalhesValue: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
  },
  detalhesValueCompact: {
    fontSize: theme.typography.fontSize.sm,
  },
  detalhesDescricao: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    lineHeight: 24,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  detalhesDescricaoCompact: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: 20,
    padding: theme.spacing.sm,
  },

  // Foto do incidente com loading/error
  fotoContainer: {
    minHeight: 200,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  fotoContainerCompact: {
    minHeight: 180,
  },
  incidenteFoto: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
  },
  incidenteFotoCompact: {
    height: 240,
  },
  fotoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  fotoLoadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  fotoErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    minHeight: 200,
  },
  fotoErrorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  fotoRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryBg,
  },
  fotoRetryText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },

  // Modal de status
  modalLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    backgroundColor: theme.colors.white,
  },
  statusOptionActive: {
    backgroundColor: theme.colors.gray50,
  },
  statusOptionText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  observacoesInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    minHeight: 100,
  },

  // Resumo cards
  resumoRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing['3xl'],
  },
  resumoCard: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  resumoValue: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontSansBold,
    marginBottom: theme.spacing.xs,
  },
  resumoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },

  // Estatísticas por motorista
  motoristaStatsContainer: {
    gap: theme.spacing.sm,
  },
  motoristaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  motoristaRank: {
    width: theme.components.avatar.size.sm,
    height: theme.components.avatar.size.sm,
    borderRadius: theme.components.avatar.size.sm / 2,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motoristaRankText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  motoristaInfo: {
    flex: 1,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaStats: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginTop: 2,
  },

  // Link para histórico do motorista
  verHistoricoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  verHistoricoLinkCompact: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  verHistoricoLinkText: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
  },
  verHistoricoLinkTextCompact: {
    fontSize: theme.typography.fontSize.sm,
  },

  // Modal de histórico
  emptyHistorico: {
    padding: theme.spacing['2xl'],
    alignItems: 'center',
  },
  emptyHistoricoText: {
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
  },
  historicoItem: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  historicoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  historicoCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  historicoCategoriaText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  historicoEndereco: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  historicoData: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  historicoDescricao: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    fontStyle: 'italic',
  },
}));
