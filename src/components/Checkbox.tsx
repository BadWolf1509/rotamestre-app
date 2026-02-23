/**
 * Checkbox - Toggle boolean input
 *
 * Accessible checkbox component with label support.
 * Uses design tokens for consistent styling.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   checked={acceptTerms}
 *   onChange={setAcceptTerms}
 *   label="Aceito os termos de uso"
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  Text,
  View,
  ViewStyle,
  Platform,
} from 'react-native';

import type { PressableStateWithHover } from '@/types';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type CheckboxSize = 'small' | 'medium' | 'large';

export interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Callback fired when checked state changes */
  onChange: (checked: boolean) => void;
  /** Label text displayed next to the checkbox */
  label?: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: CheckboxSize;
  /** Error message to display below */
  error?: string;
  /** Container style override */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

const SIZE_MAP: Record<CheckboxSize, { box: number; icon: number; fontSize: number }> = {
  small: { box: 18, icon: 14, fontSize: 13 },
  medium: { box: 22, icon: 17, fontSize: 14 },
  large: { box: 26, icon: 20, fontSize: 16 },
};

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'medium',
  error,
  style,
  testID,
}: CheckboxProps) {
  const { theme } = useUnistyles();
  const sizeTokens = SIZE_MAP[size];

  return (
    <View style={style}>
      <Pressable
        testID={testID}
        onPress={() => !disabled && onChange(!checked)}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        style={(state) => {
          const { hovered } = state as PressableStateWithHover;
          return [
            styles.row,
            hovered && !disabled && styles.hovered,
          ];
        }}
      >
        <View
          style={[
            styles.box,
            {
              width: sizeTokens.box,
              height: sizeTokens.box,
              borderRadius: theme.borderRadius.xs,
            },
            checked && styles.boxChecked,
            disabled && styles.boxDisabled,
            !!error && styles.boxError,
          ]}
        >
          {checked && (
            <Ionicons
              name="checkmark"
              size={sizeTokens.icon}
              color={disabled ? theme.colors.gray400 : theme.colors.white}
            />
          )}
        </View>
        {label && (
          <Text
            style={[
              styles.label,
              { fontSize: sizeTokens.fontSize },
              disabled && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
        )}
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['1'],
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  hovered: {
    opacity: 0.85,
  },
  box: {
    borderWidth: 2,
    borderColor: theme.colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  boxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  boxDisabled: {
    backgroundColor: theme.colors.gray100,
    borderColor: theme.colors.gray300,
  },
  boxError: {
    borderColor: theme.colors.error,
  },
  label: {
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray800,
    marginLeft: theme.spacing['2'],
    flexShrink: 1,
  },
  labelDisabled: {
    color: theme.colors.gray400,
  },
  error: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    marginTop: theme.spacing['1'],
    marginLeft: theme.spacing['1'],
  },
}));

export default Checkbox;
