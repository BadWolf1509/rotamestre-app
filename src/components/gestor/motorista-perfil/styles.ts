/**
 * Estilos compartilhados dos componentes do Perfil do Motorista
 */

import { StyleSheet, type Theme } from '@/utils/styles';

export const styles = StyleSheet.create((theme: Theme) => ({
  // ===== PerfilHeader =====
  perfilHeaderCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    ...theme.shadows.md,
  },
  perfilHeaderContent: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: theme.colors.gray100,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  perfilInfo: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  perfilNome: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    textAlign: 'center',
  },
  perfilEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
  },
  perfilTelefone: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    marginTop: theme.spacing.sm,
  },
  statusBadgeAtivo: {
    backgroundColor: theme.colors.successBg,
  },
  statusBadgeInativo: {
    backgroundColor: theme.colors.errorBg,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  statusBadgeTextAtivo: {
    color: theme.colors.success,
  },
  statusBadgeTextInativo: {
    color: theme.colors.error,
  },
  perfilDesde: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.md,
  },
  perfilActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.gray300,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: theme.colors.white,
  },
  actionButtonTextSecondary: {
    color: theme.colors.gray700,
  },

  // ===== PerformanceKPIs =====
  kpisContainer: {
    gap: theme.spacing.lg,
  },
  kpisTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  kpisGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  kpiValueSuccess: {
    color: theme.colors.success,
  },
  kpiValueWarning: {
    color: theme.colors.warning,
  },
  kpiValueError: {
    color: theme.colors.error,
  },

  // ===== RotasRecentes =====
  rotasContainer: {
    gap: theme.spacing.md,
  },
  rotasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rotasTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
  },
  rotasVerTodas: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  rotaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  rotaCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  rotaIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotaInfo: {
    flex: 1,
  },
  rotaData: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  rotaDistancia: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  rotaStatusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  rotaStatusConcluida: {
    backgroundColor: theme.colors.successBg,
  },
  rotaStatusEmAndamento: {
    backgroundColor: theme.colors.infoBg,
  },
  rotaStatusPendente: {
    backgroundColor: theme.colors.warningBg,
  },
  rotaStatusNaoExecutada: {
    backgroundColor: theme.colors.errorBg,
  },
  rotaStatusCancelada: {
    backgroundColor: theme.colors.gray100,
  },
  rotaStatusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
  },
  rotaStatusTextConcluida: {
    color: theme.colors.success,
  },
  rotaStatusTextEmAndamento: {
    color: theme.colors.info,
  },
  rotaStatusTextPendente: {
    color: theme.colors.warning,
  },
  rotaStatusTextNaoExecutada: {
    color: theme.colors.error,
  },
  rotaStatusTextCancelada: {
    color: theme.colors.gray600,
  },
  emptyRotas: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing['3xl'],
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  emptyRotasText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },

  // ===== Layout Geral =====
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.xl,
    gap: theme.spacing.xl,
  },
  contentDesktop: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: 1400,
    marginHorizontal: 'auto',
    width: '100%',
  },
  splitContainer: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
  },
  leftColumn: {
    width: 320,
  },
  rightColumn: {
    flex: 1,
    gap: theme.spacing.xl,
  },

  // ===== Loading/Error States =====
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray50,
  },
  errorText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  backButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },

  // ===== Skeleton =====
  skeletonCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    ...theme.shadows.md,
  },
  skeletonCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.gray200,
    alignSelf: 'center',
  },
  skeletonLine: {
    height: 16,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    marginTop: theme.spacing.md,
  },
  skeletonLineShort: {
    width: '60%',
    alignSelf: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  skeletonKpi: {
    flex: 1,
    minWidth: 140,
    height: 100,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
  },
}));
