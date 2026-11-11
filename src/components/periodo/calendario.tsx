/**
 * Estilos e ícones do calendário de intervalo (react-native-ui-datepicker),
 * usados pelo `PainelPersonalizado` (seletor de período).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useDefaultStyles } from 'react-native-ui-datepicker';

import { useUnistyles } from '@/utils/styles';

export function useCalendario() {
  const { theme } = useUnistyles();
  const defaultStyles = useDefaultStyles('light');

  const styles = {
    ...defaultStyles,
    headerText: {
      color: theme.colors.gray900,
      fontWeight: '600' as const,
    },
    monthText: {
      color: theme.colors.gray900,
      fontWeight: '700' as const,
    },
    weekDaysText: {
      color: theme.colors.gray800,
      fontWeight: '600' as const,
    },
    dayText: {
      color: theme.colors.gray900,
      fontWeight: '500' as const,
    },
    dayNumber: {
      color: theme.colors.gray900,
    },
    daySelectedText: {
      color: theme.colors.gray900,
      fontWeight: '700' as const,
    },
    button_prev: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    button_next: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    button_prev_image: {
      tintColor: theme.colors.gray900,
    },
    button_next_image: {
      tintColor: theme.colors.gray900,
    },
    range_fill: {
      backgroundColor: theme.colors.primaryBg,
    },
    range_start: {
      backgroundColor: theme.colors.primary,
    },
    range_end: {
      backgroundColor: theme.colors.primary,
    },
    range_middle: {
      backgroundColor: theme.colors.primaryLight,
    },
    selected: {
      backgroundColor: theme.colors.primary,
    },
  };

  const components = {
    IconPrev: (
      <Ionicons name="chevron-back" size={18} color={theme.colors.gray900} />
    ),
    IconNext: (
      <Ionicons name="chevron-forward" size={18} color={theme.colors.gray900} />
    ),
  };

  return { styles, components };
}
