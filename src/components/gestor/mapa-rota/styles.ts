/**
 * Estilos compartilhados dos componentes do Mapa da Rota
 */

import { Dimensions, Platform } from 'react-native';

import { StyleSheet, type Theme } from '@/utils/styles';

export const MAP_HEIGHT = 600;

export const styles = StyleSheet.create((theme: Theme) => ({
  // ===== ParadaCard =====
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  paradaCardSelected: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  paradaHeader: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  paradaNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  paradaNumeroText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: 'bold',
  },
  paradaHeaderInfo: {
    flex: 1,
  },
  paradaHeaderTop: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  paradaEndereco: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: '600',
    color: theme.colors.gray900,
    lineHeight: 20,
  },
  paradaTags: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tipoTag: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  tipoTagEntrega: {
    backgroundColor: theme.colors.infoBg,
  },
  tipoTagRetirada: {
    backgroundColor: theme.colors.warningBg,
  },
  tipoTagText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statusTag: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  statusTagConcluida: {
    backgroundColor: theme.colors.successBg,
  },
  statusTagPendente: {
    backgroundColor: theme.colors.errorBg,
  },
  statusTagEmAndamento: {
    backgroundColor: theme.colors.infoBg,
  },
  statusTagText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaDetalhes: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  paradaMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  paradaMetaItem: {
    flex: 1,
    minWidth: 100,
  },
  paradaMetaItemFull: {
    width: '100%',
  },
  paradaMetaLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paradaMetaValue: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray900,
    marginTop: 2,
  },
  // Telefone clicável
  paradaTelefoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  paradaTelefoneLinkText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  // Foto com overlay melhorado
  paradaFotoContainer: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  paradaFoto: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  paradaFotoOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paradaFotoOverlayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Placeholder para parada sem foto
  paradaFotoPlaceholder: {
    marginTop: theme.spacing.sm,
    height: 80,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  paradaFotoPlaceholderText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
  },

  // ===== ResumoStats =====
  resumoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumoStat: {
    alignItems: 'center',
  },
  resumoStatValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.xs,
  },
  resumoStatValueSuccess: {
    color: theme.colors.success,
  },
  resumoStatValueWarning: {
    color: theme.colors.warning,
  },
  resumoStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  resumoDesktopGrid: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
  },
  resumoDesktopItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  resumoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumoDesktopValue: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['2xl'],
  },
  resumoDesktopLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resumoUpdated: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },

  // ===== BaseInfoContent =====
  baseInfoList: {
    gap: theme.spacing.md,
  },
  baseInfoItemRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  baseInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseInfoTexts: {
    flex: 1,
  },
  baseInfoLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  baseInfoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    marginTop: 2,
  },
  baseInfoEmpty: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  baseInfoLink: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  baseInfoLinkText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // ===== RouteInfoHeader =====
  infoHeaderBar: {
    backgroundColor: theme.colors.white,
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  infoHeaderChipGroup: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    backgroundColor: theme.colors.gray50,
  },
  driverLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  driverName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.gray100,
  },
  statusBadgeDesktop: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  statusBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  statusBadgeTextDesktop: {
    fontSize: theme.typography.fontSize.sm,
  },
  cancelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: `${theme.colors.error}55`,
    backgroundColor: `${theme.colors.errorBg}50`,
  },
  cancelChipText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  infoChipLabel: {
    fontSize: 14,
    color: theme.colors.gray600,
  },
  infoChipValue: {
    fontSize: 14,
    color: theme.colors.gray900,
    fontWeight: '600',
  },

  // ===== PhotoModal =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: Dimensions.get('window').width - 40,
    maxHeight: Dimensions.get('window').height - 100,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalCloseButtonText: {
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.gray900,
    fontWeight: 'bold',
  },
  fotoGrande: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.lg,
  },
  desktopModalImage: {
    width: '100%',
    height: 500,
  },

  // ===== Skeleton =====
  skeletonContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  skeletonHeader: {
    backgroundColor: theme.colors.white,
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
    height: 72,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  skeletonPulse: {
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
  },
  skeletonMap: {
    height: MAP_HEIGHT,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
  },
  skeletonCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  skeletonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  skeletonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray200,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
  },
  skeletonLineShort: {
    width: '60%',
  },
  skeletonLineMedium: {
    width: '80%',
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  skeletonTag: {
    width: 60,
    height: 24,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray200,
  },

  // Skeleton - Novo layout otimizado
  skeletonCardCompact: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 4,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  skeletonHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  skeletonResumoInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm + 2,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  skeletonTimelineCollapsible: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    padding: theme.spacing.md,
  },

  // ===== General / Layout =====
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
  },
  backButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  paradasContainer: {
    // Content padding handled by parent
  },
  paradasTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  emptyParadas: {
    padding: theme.spacing['3xl'],
    alignItems: 'center',
  },
  emptyParadasText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray500,
  },
  resumo: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  resumoTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  baseInfoCard: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.primaryBg,
  },
  baseInfoTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  mapContainer: {
    height: 400,
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  mapContainerSplit: {
    height: '100%',
    minHeight: 700,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  desktopInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing['2xl'],
    marginTop: theme.spacing['2xl'],
    alignItems: 'stretch',
  },
  desktopInfoColumn: {
    flexBasis: '40%',
    flexGrow: 1,
    minWidth: 280,
  },
  desktopInfoColumnWide: {
    flexBasis: '55%',
    flexGrow: 1,
    minWidth: 320,
  },
  timelineChip: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  timelineChipText: {
    color: theme.colors.gray600,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: 1280,
    marginHorizontal: 'auto',
    width: '100%',
  },
  rotaInfo: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  motoristaData: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray700,
    fontFamily: theme.typography.fontSansMedium,
    marginBottom: theme.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Empty State
  emptyStateContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.xl,
  },
  emptyStateBackLink: {
    marginBottom: theme.spacing.xl,
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 100,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing['3xl'],
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 320,
    shadowColor: theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateOr: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing.lg,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 320,
    borderWidth: 2,
    borderColor: theme.colors.primaryDark,
  },
  secondaryButtonText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  backLinkText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
