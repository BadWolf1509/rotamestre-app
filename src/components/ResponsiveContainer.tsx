import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Estilo customizado */
  style?: ViewStyle;
  /** Max width no desktop (padrão: 1280) */
  maxWidth?: number;
  /** Padding horizontal (padrão: auto por breakpoint) */
  padding?: number;
  /** Centralizar no desktop? (padrão: true) */
  center?: boolean;
}

/**
 * Container responsivo que adapta padding e max-width por breakpoint
 *
 * IMPORTANTE: No desktop com sidebar, o maxWidth de 1280px é seguro porque:
 * - Layout total = sidebar (260px) + conteúdo
 * - ResponsiveContainer usa marginHorizontal: 'auto' para centralizar
 * - Em 1920px: 260 (sidebar) + 1280 (max) + padding = ~1600px (cabe confortável)
 * - Em 1280px: Conteúdo reduz automaticamente com padding lateral
 *
 * @example
 * ```tsx
 * <ResponsiveContainer>
 *   <Text>Conteúdo responsivo</Text>
 * </ResponsiveContainer>
 * ```
 */
export function ResponsiveContainer({
  children,
  style,
  maxWidth = 1280,
  padding,
  center = true,
}: ResponsiveContainerProps) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Padding padrão por breakpoint
  const defaultPadding = isMobile ? 16 : isTablet ? 24 : 32;
  const horizontalPadding = padding !== undefined ? padding : defaultPadding;

  const containerStyle: ViewStyle = {
    width: '100%',
    paddingHorizontal: horizontalPadding,
    paddingVertical: isDesktop ? 24 : 16, // Padding vertical para não colar no topo
    ...(isDesktop && center && {
      maxWidth,
      marginHorizontal: 'auto',
    }),
  };

  return <View style={[containerStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({});
