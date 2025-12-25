/**
 * Tests for MapaRotaSkeleton.tsx
 * Skeleton loading para página Mapa da Rota
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { MapaRotaSkeleton } from '../MapaRotaSkeleton';

// Mock dependencies
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      secondary: '#f7a02a',
      success: '#10b981',
      warning: '#f7a02a',
      info: '#3b82f6',
      white: '#ffffff',
      gray50: '#f9fafb',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    typography: { fontSize: { xs: 12, sm: 14 } },
    borderRadius: { md: 10, lg: 16 },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock the styles import from the component
jest.mock('../styles', () => ({
  styles: {
    skeletonContainer: {},
    rotaInfo: {},
    skeletonPulse: { backgroundColor: '#e5e7eb' },
    skeletonLine: { height: 12 },
    skeletonLineMedium: { width: '60%' },
    skeletonLineShort: { width: '40%' },
    skeletonCard: { padding: 12, marginBottom: 8 },
    skeletonCardHeader: { flexDirection: 'row', gap: 8 },
    skeletonCircle: { width: 40, height: 40, borderRadius: 20 },
    skeletonRow: { flexDirection: 'row', gap: 8 },
    skeletonTag: { width: 60, height: 24, borderRadius: 4 },
    skeletonMap: { borderRadius: 12 },
    skeletonCardCompact: { padding: 8, marginBottom: 4 },
    skeletonHeaderCompact: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    skeletonResumoInline: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    skeletonTimelineCollapsible: { padding: 12 },
  },
}));

// Mock desktop components
jest.mock('@/components/desktop/DesktopCard', () => ({
  DesktopCard: ({ children, title }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="desktop-card">
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/desktop/DesktopPageLayout', () => ({
  DesktopPageLayout: ({ children, title }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="desktop-page-layout">
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

jest.mock('@/components/desktop/SplitView', () => ({
  SplitView: ({ left, right }: any) => {
    const { View } = require('react-native');
    return (
      <View testID="split-view">
        <View testID="split-left">{left}</View>
        <View testID="split-right">{right}</View>
      </View>
    );
  },
}));

jest.mock('@/constants/gestorPageMeta', () => ({
  getGestorPageMeta: () => ({
    title: 'Mapa da Rota',
    subtitle: 'Visualize e gerencie a rota',
    breadcrumbs: [{ label: 'Dashboard' }, { label: 'Mapa' }],
  }),
}));

describe('MapaRotaSkeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Desktop Layout', () => {
    it('deve renderizar layout desktop quando isDesktop=true', () => {
      const { getByTestId } = render(<MapaRotaSkeleton isDesktop={true} />);

      expect(getByTestId('desktop-page-layout')).toBeTruthy();
    });

    it('deve renderizar SplitView no desktop', () => {
      const { getByTestId } = render(<MapaRotaSkeleton isDesktop={true} />);

      expect(getByTestId('split-view')).toBeTruthy();
    });

    it('deve renderizar card do mapa no lado esquerdo', () => {
      const { getByTestId, getByText } = render(<MapaRotaSkeleton isDesktop={true} />);

      expect(getByTestId('split-left')).toBeTruthy();
      expect(getByText('Mapa')).toBeTruthy();
    });

    it('deve renderizar card de paradas no lado direito', () => {
      const { getByTestId, getByText } = render(<MapaRotaSkeleton isDesktop={true} />);

      expect(getByTestId('split-right')).toBeTruthy();
      expect(getByText('Paradas')).toBeTruthy();
    });

    it('deve passar props de userMenu', () => {
      const userMenuTrigger = <div>Menu</div>;
      const userMenuItems = [{ label: 'Item', onPress: jest.fn() }];

      const { getByTestId } = render(
        <MapaRotaSkeleton
          isDesktop={true}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
        />
      );

      expect(getByTestId('desktop-page-layout')).toBeTruthy();
    });
  });

  describe('Mobile Layout', () => {
    it('deve renderizar layout mobile quando isDesktop=false', () => {
      const { queryByTestId } = render(<MapaRotaSkeleton isDesktop={false} />);

      // Não deve ter SplitView no mobile
      expect(queryByTestId('split-view')).toBeNull();
    });

    it('não deve renderizar DesktopPageLayout no mobile', () => {
      const { queryByTestId } = render(<MapaRotaSkeleton isDesktop={false} />);

      expect(queryByTestId('desktop-page-layout')).toBeNull();
    });
  });

  describe('Props padrão', () => {
    it('deve usar isDesktop=true como padrão', () => {
      const { getByTestId } = render(<MapaRotaSkeleton />);

      expect(getByTestId('desktop-page-layout')).toBeTruthy();
    });
  });

  describe('Skeleton Elements', () => {
    it('deve renderizar skeleton cards no desktop', () => {
      const { getAllByTestId } = render(<MapaRotaSkeleton isDesktop={true} />);

      // Deve haver ao menos um desktop-card
      expect(getAllByTestId('desktop-card').length).toBeGreaterThan(0);
    });
  });
});
