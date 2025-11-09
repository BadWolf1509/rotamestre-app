import React from 'react';
import { View, ScrollView, ViewStyle } from 'react-native';

import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet } from '@/utils/styles';

/**
 * DesktopLayout - Wrapper responsivo para conteúdo
 *
 * Aplica automaticamente:
 * - Max-width em desktop (1280px)
 * - Padding responsivo (mobile: md, tablet: lg, desktop: xl)
 * - Centralização em desktop
 * - Background color configurável
 *
 * @example
 * <DesktopLayout>
 *   <Text>Conteúdo centralizado e com padding responsivo</Text>
 * </DesktopLayout>
 *
 * @example Com scroll
 * <DesktopLayout scrollable>
 *   <LongContent />
 * </DesktopLayout>
 */

interface DesktopLayoutProps {
  children: React.ReactNode;
  /** Permitir scroll vertical (default: false) */
  scrollable?: boolean;
  /** Max-width personalizado (default: 1280) */
  maxWidth?: number;
  /** Background color (default: gray50) */
  backgroundColor?: string;
  /** Estilo adicional para o container */
  style?: ViewStyle;
  /** Estilo adicional para o content wrapper */
  contentStyle?: ViewStyle;
}

export function DesktopLayout({
  children,
  scrollable = false,
  maxWidth = 1280,
  backgroundColor,
  style,
  contentStyle,
}: DesktopLayoutProps) {
  const { isDesktop, isTablet } = useResponsive();

  const containerStyles = [
    styles.container,
    backgroundColor && { backgroundColor },
    style,
  ];

  const contentStyles = [
    styles.content,
    isDesktop && { maxWidth, marginHorizontal: 'auto' },
    isDesktop && styles.desktopPadding,
    isTablet && styles.tabletPadding,
    !isDesktop && !isTablet && styles.mobilePadding,
    contentStyle,
  ];

  if (scrollable) {
    return (
      <ScrollView style={containerStyles} contentContainerStyle={contentStyles}>
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={containerStyles}>
      <View style={contentStyles}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  mobilePadding: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  tabletPadding: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  desktopPadding: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing['2xl'],
  },
}));
