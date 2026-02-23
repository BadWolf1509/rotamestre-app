/**
 * Alert - Inline alert banner
 *
 * Displays contextual feedback messages inline (not modal).
 * For modal alerts, use Dialog or useAlert instead.
 *
 * @example
 * ```tsx
 * <Alert
 *   type="warning"
 *   title="Atenção"
 *   message="Sua assinatura expira em 3 dias."
 *   onClose={() => setShowAlert(false)}
 * />
 * ```
 *
 * @example Without close button
 * ```tsx
 * <Alert
 *   type="info"
 *   message="Atualizações disponíveis para o app."
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';

import { withOpacity } from '@/utils/color';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  /** Alert type determines color and icon */
  type?: AlertType;
  /** Optional title (bold) */
  title?: string;
  /** Alert message body */
  message: string;
  /** Show close button and call this on dismiss */
  onClose?: () => void;
  /** Optional action button */
  actionLabel?: string;
  /** Callback for action button */
  onAction?: () => void;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

const ICON_MAP: Record<AlertType, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'close-circle',
};

export function Alert({
  type = 'info',
  title,
  message,
  onClose,
  actionLabel,
  onAction,
  style,
  testID,
}: AlertProps) {
  const { theme } = useUnistyles();

  const colorMap: Record<AlertType, string> = {
    info: theme.colors.info,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };

  const accentColor = colorMap[type];
  const bgColor = withOpacity(accentColor, 0.08);

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        { backgroundColor: bgColor, borderLeftColor: accentColor },
        style,
      ]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={ICON_MAP[type]}
        size={20}
        color={accentColor}
        style={styles.icon}
      />

      <View style={styles.content}>
        {title && <Text style={[styles.title, { color: accentColor }]}>{title}</Text>}
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: accentColor }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={theme.colors.gray500} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing['3'],
    gap: theme.spacing['2.5'],
  },
  icon: {
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing['0.5'],
  },
  message: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.fontSize.sm * 1.5,
    color: theme.colors.gray700,
  },
  actionBtn: {
    marginTop: theme.spacing['2'],
  },
  actionText: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  closeBtn: {
    padding: theme.spacing['1'],
    marginLeft: theme.spacing['1'],
  },
}));

export default Alert;
