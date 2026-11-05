import React from 'react';
import type { ViewStyle } from 'react-native';

import { EmptyState } from '@/components/EmptyState';

interface MobileEmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  fullScreen?: boolean;
}

/**
 * @deprecated Adaptador temporário (R-UI-2): delega ao `EmptyState` do design
 * system, traduzindo `icon`→`emoji`, `subtitle`→`description` e
 * `onAction`→`onActionPress`. Sem `fullScreen` o estado é `compact` (não ocupa
 * a tela), como o componente antigo. Os chamadores em `app/` migram para o
 * `EmptyState` na Fase 2; depois disso este arquivo some.
 */
export function MobileEmptyState({
  icon = '📋',
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
  fullScreen = false,
}: MobileEmptyStateProps) {
  return (
    <EmptyState
      emoji={icon}
      title={title}
      description={subtitle}
      actionLabel={actionLabel}
      onActionPress={onAction}
      fullScreen={fullScreen}
      compact={!fullScreen}
      style={style}
    />
  );
}
