/**
 * Estilos do MainCard
 * Extraídos para arquivo separado para melhor manutenibilidade
 */

import { StyleSheet, type Theme } from '@/utils/styles';

export const styles = StyleSheet.create((theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.lg,
    // Elevated card (design system token)
    ...theme.shadows.md,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.5,
  },
  badgeTextDark: {
    color: theme.colors.warningText,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  timerText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  icon: {
    fontSize: theme.spacing['5xl'],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  empresaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  empresa: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  pendingBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.lg,
  },
  pendingBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  addressMain: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  noRouteHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  noRouteIconContainer: {
    width: theme.components.avatar.size.md,
    height: theme.components.avatar.size.md,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  motivationalEmoji: {
    fontSize: theme.typography.fontSize['2xl'],
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  waitingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    fontStyle: 'italic',
  },
  noRouteDivider: {
    height: 1,
    backgroundColor: theme.colors.gray100,
    marginVertical: theme.spacing.md,
  },
  expirationWarningContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  quickLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  quickLinkText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.sm,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statIconBg: {
    width: theme.components.minTouchTarget,
    height: theme.components.minTouchTarget,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  statValue: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  noStatsContainer: {
    marginTop: theme.spacing.sm,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: 2,
  },
  tipText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    lineHeight: 16,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
    alignSelf: 'center',
  },
  streakText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  statsComparison: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statsColumnHeader: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansBold,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  statsColumnContent: {
    gap: theme.spacing.xs,
  },
  statsDivider: {
    width: 1,
    backgroundColor: theme.colors.gray200,
    marginHorizontal: theme.spacing.md,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  miniStatValue: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  // Estilos para o novo layout pending
  pendingStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  pendingStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pendingStatValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  pendingStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  pendingStatDivider: {
    width: 1,
    height: theme.components.avatar.size.sm,
  },
  firstStopSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    paddingTop: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  addressText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  distanceText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  contactText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  observationBox: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  observationText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.warningText,
  },
  streetViewContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.xs,
    marginTop: theme.spacing.sm,
  },
  swipeHintText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  summaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.lg,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  executiveSummary: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  executiveRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  executiveItem: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  executiveValue: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  executiveLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  readyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontSansMedium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
  },
  statNumber: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  // Estilos para estado completed (celebração)
  celebrationContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  celebrationCircle: {
    width: theme.components.avatar.size.xl,
    height: theme.components.avatar.size.xl,
    borderRadius: theme.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  milestoneEmoji: {
    fontSize: theme.typography.fontSize['3xl'],
  },
  milestoneTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansBold,
  },
  milestoneSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    marginTop: 2,
  },
  completedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
  },
  completedStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  completedStatValue: {
    fontSize: theme.typography.fontSize.lg,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  completedStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    fontFamily: theme.typography.fontSansMedium,
  },
  completedStatDivider: {
    width: 1,
    height: theme.spacing['4xl'],
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  detailsButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
}));
