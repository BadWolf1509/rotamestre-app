/**
 * Radio & RadioGroup - Single-selection input
 *
 * Radio buttons for selecting one option from a group.
 * Uses design tokens for consistent styling.
 *
 * @example
 * ```tsx
 * <RadioGroup
 *   value={selected}
 *   onChange={setSelected}
 *   options={[
 *     { value: 'entrega', label: 'Entrega' },
 *     { value: 'retirada', label: 'Retirada' },
 *   ]}
 * />
 * ```
 */

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

type RadioSize = 'small' | 'medium' | 'large';

export interface RadioOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

// --- Radio (single item) ---

export interface RadioProps {
  /** Whether this radio is selected */
  selected: boolean;
  /** Callback fired on press */
  onPress: () => void;
  /** Label text */
  label: string;
  /** Whether this radio is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: RadioSize;
  /** Test ID */
  testID?: string;
}

const SIZE_MAP: Record<RadioSize, { outer: number; inner: number; fontSize: number }> = {
  small: { outer: 18, inner: 8, fontSize: 13 },
  medium: { outer: 22, inner: 10, fontSize: 14 },
  large: { outer: 26, inner: 12, fontSize: 16 },
};

export function Radio({
  selected,
  onPress,
  label,
  disabled = false,
  size = 'medium',
  testID,
}: RadioProps) {
  const { theme: _theme } = useUnistyles();
  const sizeTokens = SIZE_MAP[size];

  return (
    <Pressable
      testID={testID}
      onPress={() => !disabled && onPress()}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
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
          styles.outer,
          {
            width: sizeTokens.outer,
            height: sizeTokens.outer,
            borderRadius: sizeTokens.outer / 2,
          },
          selected && styles.outerSelected,
          disabled && styles.outerDisabled,
        ]}
      >
        {selected && (
          <View
            style={[
              styles.inner,
              {
                width: sizeTokens.inner,
                height: sizeTokens.inner,
                borderRadius: sizeTokens.inner / 2,
              },
              disabled && styles.innerDisabled,
            ]}
          />
        )}
      </View>
      <Text
        style={[
          styles.label,
          { fontSize: sizeTokens.fontSize },
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// --- RadioGroup ---

export interface RadioGroupProps<T extends string = string> {
  /** Currently selected value */
  value: T | null;
  /** Callback fired when selection changes */
  onChange: (value: T) => void;
  /** Available options */
  options: RadioOption<T>[];
  /** Size variant */
  size?: RadioSize;
  /** Horizontal layout */
  horizontal?: boolean;
  /** Label for the group */
  label?: string;
  /** Error message */
  error?: string;
  /** Container style */
  style?: ViewStyle;
  /** Test ID prefix */
  testID?: string;
}

export function RadioGroup<T extends string = string>({
  value,
  onChange,
  options,
  size = 'medium',
  horizontal = false,
  label,
  error,
  style,
  testID,
}: RadioGroupProps<T>) {
  return (
    <View style={style} accessibilityRole="radiogroup">
      {label && <Text style={styles.groupLabel}>{label}</Text>}
      <View style={[styles.group, horizontal && styles.groupHorizontal]}>
        {options.map((option) => (
          <Radio
            key={option.value}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            label={option.label}
            disabled={option.disabled}
            size={size}
            testID={testID ? `${testID}-${option.value}` : undefined}
          />
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['1.5'],
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  hovered: {
    opacity: 0.85,
  },
  outer: {
    borderWidth: 2,
    borderColor: theme.colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
  },
  outerSelected: {
    borderColor: theme.colors.primary,
  },
  outerDisabled: {
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.gray100,
  },
  inner: {
    backgroundColor: theme.colors.primary,
  },
  innerDisabled: {
    backgroundColor: theme.colors.gray400,
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
  group: {
    gap: theme.spacing['0.5'],
  },
  groupHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing['4'],
  },
  groupLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    marginBottom: theme.spacing['2'],
  },
  error: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    marginTop: theme.spacing['1'],
  },
}));

export default RadioGroup;
