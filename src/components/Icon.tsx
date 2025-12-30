import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { useUnistyles, type Theme } from '@/utils/styles';

type IconTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error' | 'inverse';
type IconSize = 'sm' | 'md' | 'lg' | 'xl' | number;

interface IconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: IconSize;
  tone?: IconTone;
  color?: string;
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

const getToneColor = (theme: Theme, tone: IconTone): string => {
  switch (tone) {
    case 'muted':
      return theme.colors.gray500;
    case 'primary':
      return theme.colors.primary;
    case 'success':
      return theme.colors.success;
    case 'warning':
      return theme.colors.warning;
    case 'error':
      return theme.colors.error;
    case 'inverse':
      return theme.colors.white;
    case 'default':
    default:
      return theme.colors.gray700;
  }
};

export function Icon({ name, size = 'md', tone = 'default', color }: IconProps) {
  const { theme } = useUnistyles();
  const resolvedSize = typeof size === 'number' ? size : sizeMap[size];
  const resolvedColor = color ?? getToneColor(theme, tone);

  return <Ionicons name={name} size={resolvedSize} color={resolvedColor} />;
}

export default Icon;
