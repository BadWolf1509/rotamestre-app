import React from 'react';
import { View, Platform } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { GestorDesktopLayout } from './GestorDesktopLayout';
import { DrawerMenuProvider } from '@/context/DrawerMenuContext';

interface GestorAdaptiveLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout adaptativo para o módulo Gestor
 *
 * Renderiza diferentes layouts baseado na plataforma e tamanho da tela:
 * - Desktop (≥1024px): Sidebar fixa + área principal
 * - Tablet (768-1023px): Sidebar colapsável + área principal
 * - Mobile (<768px): Drawer menu + navegação Stack
 *
 * Features por plataforma:
 * - Desktop: Hover effects, tooltips, atalhos de teclado
 * - Touch: Swipe gestures, pull-to-refresh
 * - Mobile: Bottom sheets, FAB
 */
export function GestorAdaptiveLayout({ children }: GestorAdaptiveLayoutProps) {
  const { isDesktop, isTablet, isMobile, isWeb, breakpoint } = useResponsive();

  // Desktop Layout (Web only, ≥1024px)
  if (isWeb && isDesktop) {
    return <GestorDesktopLayout>{children}</GestorDesktopLayout>;
  }

  // Tablet Layout (Web or Native, 768-1023px)
  if (isTablet) {
    return (
      <DrawerMenuProvider>
        <View style={{ flex: 1 }}>
          {/* Tablet usa desktop layout com sidebar colapsada por padrão */}
          <GestorDesktopLayout>{children}</GestorDesktopLayout>
        </View>
      </DrawerMenuProvider>
    );
  }

  // Mobile Layout (Web or Native, <768px)
  // Mobile usa o DrawerMenu existente através do _layout.tsx
  return (
    <DrawerMenuProvider>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </DrawerMenuProvider>
  );
}

/**
 * Hook para obter informações específicas do layout do Gestor
 */
export function useGestorLayout() {
  const responsive = useResponsive();

  return {
    ...responsive,
    // Layout específico
    hasSidebar: responsive.isDesktop || responsive.isTablet,
    hasDrawer: responsive.isMobile,
    hasBottomTabs: responsive.isMobile && responsive.isNative,
    // Configurações de grid
    gridColumns: responsive.isDesktop ? 4 : responsive.isTablet ? 2 : 1,
    // Tamanhos de card
    cardSize: responsive.isDesktop ? 'small' : responsive.isTablet ? 'medium' : 'large',
    // Configurações de tabela
    showDataTable: responsive.isDesktop || responsive.isTablet,
    showCardList: responsive.isMobile,
  };
}