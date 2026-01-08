/**
 * Shared styles for DataTable components
 */

import { Platform } from 'react-native';

import { boxShadow } from '@/utils/color';
import { StyleSheet, type Theme } from '@/utils/styles';

export const dataTableStyles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  emptyState: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  emptyText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
  },

  // ============================================
  // MOBILE STYLES (Cards)
  // ============================================
  mobileContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    flex: 1,
  },
  cardValue: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    flex: 2,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  cardActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.components.table.actionButtonPaddingY,
    paddingHorizontal: theme.components.table.actionButtonPaddingX,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    gap: theme.spacing['1'],
  },
  cardActionButtonDanger: {
    backgroundColor: `${theme.colors.error}20`,
  },
  cardActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  cardActionText: {
    fontSize: theme.components.table.actionButtonFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  cardActionTextDanger: {
    color: theme.colors.error,
  },
  cardActionTextSecondary: {
    color: theme.colors.gray600,
  },

  // ============================================
  // DESKTOP STYLES (Table)
  // ============================================
  tableContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray50,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.md,
  },
  tableHeaderCell: {
    padding: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: theme.components.table.headerFontSize,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray700,
  },
  sortIndicator: {
    fontSize: theme.components.table.headerFontSize - 2,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primary,
    marginLeft: theme.spacing['1'],
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing.md,
    ...(Platform.OS === 'web' &&
      ({
        cursor: 'default',
        transitionProperty: 'background-color',
        transitionDuration: '0.15s',
        transitionTimingFunction: 'ease-in-out',
        ':hover': {
          backgroundColor: theme.colors.primary + '08',
        },
      } as any)),
  },
  tableRowEven: {
    backgroundColor: theme.colors.gray50,
  },
  tableCell: {
    padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: theme.components.table.rowFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
  },
  tableCellTextNoWrap: {
    ...(Platform.OS === 'web'
      ? {
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }
      : {}),
  },
  tableCellActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  tableActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.components.table.actionButtonPaddingY,
    paddingHorizontal: theme.components.table.actionButtonPaddingX,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    gap: theme.spacing['1'],
    ...(Platform.OS === 'web' &&
      ({
        cursor: 'pointer',
        transitionProperty: 'all',
        transitionDuration: '0.2s',
        transitionTimingFunction: 'ease-in-out',
        ':hover': {
          backgroundColor: theme.colors.primary + '15',
          transform: 'translateY(-1px)',
          boxShadow: boxShadow(0, 2, 4, 0, theme.colors.black, 0.1),
        },
      } as any)),
  },
  tableActionButtonDanger: {
    backgroundColor: `${theme.colors.error}20`,
  },
  tableActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  tableActionText: {
    fontSize: theme.components.table.actionButtonFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  tableActionTextDanger: {
    color: theme.colors.error,
  },
  tableActionTextSecondary: {
    color: theme.colors.gray600,
  },

  // ============================================
  // PAGINATION
  // ============================================
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
    marginTop: theme.spacing.sm,
  },
  paginationDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pageButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  pageButtonDisabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.5,
  },
  pageButtonText: {
    color: theme.colors.background,
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  pageInfo: {
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray500,
  },
  pageInfoDesktop: {
    fontSize: theme.components.table.paginationFontSize,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },

  // ============================================
  // SKELETON LOADING
  // ============================================
  skeletonBox: {
    height: 16,
    backgroundColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.xs,
    flex: 1,
  },
}));
