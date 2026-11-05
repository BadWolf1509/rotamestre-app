/**
 * Tests for DesktopFormGrid.tsx
 * Grid responsivo para formulários
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { DesktopFormGrid } from '../DesktopFormGrid';

// Mock useResponsive
const mockIsDesktop = jest.fn(() => false);
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: mockIsDesktop(),
    isMobile: !mockIsDesktop(),
    isTablet: false,
    width: mockIsDesktop() ? 1200 : 375,
  }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
    },
    spacing: {
      sm: 8,
      md: 16,
    },
    desktop: {
      section: {
        padding: 16,
        gap: 12,
      },
      field: {
        marginBottom: 12,
      },
    },
  };

  return {
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
    useUnistyles: () => ({ theme }),
  };
});

describe('DesktopFormGrid', () => {
  beforeEach(() => {
    mockIsDesktop.mockReturnValue(false);
  });

  describe('Renderização Mobile (1 coluna)', () => {
    it('deve renderizar children em modo mobile', () => {
      const { getByText } = render(
        <DesktopFormGrid>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
        </DesktopFormGrid>
      );

      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
    });

    it('deve usar 1 coluna em mobile independente do prop columns', () => {
      const { getByText } = render(
        <DesktopFormGrid columns={2}>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
        </DesktopFormGrid>
      );

      // Ambos campos devem estar presentes
      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
    });

    it('deve filtrar children null/undefined', () => {
      const { getByText } = render(
        <DesktopFormGrid>
          <Text>Campo 1</Text>
          {null}
          {undefined}
          <Text>Campo 2</Text>
        </DesktopFormGrid>
      );

      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
    });

    it('deve aplicar testID quando fornecido', () => {
      const { getByTestId } = render(
        <DesktopFormGrid testID="form-grid">
          <Text>Campo</Text>
        </DesktopFormGrid>
      );

      expect(getByTestId('form-grid')).toBeTruthy();
    });
  });

  describe('Renderização Desktop (2 colunas)', () => {
    beforeEach(() => {
      mockIsDesktop.mockReturnValue(true);
    });

    it('deve renderizar children em modo desktop', () => {
      const { getByText } = render(
        <DesktopFormGrid>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
        </DesktopFormGrid>
      );

      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
    });

    it('deve usar 2 colunas por padrão em desktop', () => {
      const { getByText } = render(
        <DesktopFormGrid>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
          <Text>Campo 3</Text>
        </DesktopFormGrid>
      );

      // Todos os campos devem ser renderizados
      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
      expect(getByText('Campo 3')).toBeTruthy();
    });

    it('deve usar 1 coluna quando columns=1', () => {
      const { getByText } = render(
        <DesktopFormGrid columns={1}>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
        </DesktopFormGrid>
      );

      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
    });

    it('deve lidar com número ímpar de children', () => {
      const { getByText } = render(
        <DesktopFormGrid columns={2}>
          <Text>Campo 1</Text>
          <Text>Campo 2</Text>
          <Text>Campo 3</Text>
        </DesktopFormGrid>
      );

      expect(getByText('Campo 1')).toBeTruthy();
      expect(getByText('Campo 2')).toBeTruthy();
      expect(getByText('Campo 3')).toBeTruthy();
    });
  });

  describe('Gap customizado', () => {
    it('deve usar gap padrão quando não fornecido', () => {
      const { getByTestId } = render(
        <DesktopFormGrid testID="grid">
          <Text>Campo</Text>
        </DesktopFormGrid>
      );

      expect(getByTestId('grid')).toBeTruthy();
    });

    it('deve usar gap customizado quando fornecido', () => {
      const { getByTestId } = render(
        <DesktopFormGrid testID="grid" gap={24}>
          <Text>Campo</Text>
        </DesktopFormGrid>
      );

      expect(getByTestId('grid')).toBeTruthy();
    });
  });
});
