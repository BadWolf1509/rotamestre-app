/**
 * Tests for CollapsibleSection.tsx
 * Seção expansível para progressive disclosure
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { CollapsibleSection } from '../CollapsibleSection';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    width: 375,
  }),
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      primaryBg: '#e8edfa',
      gray50: '#f9fafb',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray700: '#374151',
    },
    spacing: {
      sm: 8,
      md: 16,
    },
    borderRadius: {
      sm: 4,
      md: 8,
    },
    typography: {
      fontSize: {
        xs: 12,
        sm: 14,
        base: 16,
      },
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

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('CollapsibleSection (Native)', () => {
  describe('Renderização básica', () => {
    it('deve renderizar título', () => {
      const { getByText } = render(
        <CollapsibleSection title="Detalhes adicionais">
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByText('Detalhes adicionais')).toBeTruthy();
    });

    it('deve mostrar chevron-forward quando recolhido', () => {
      const { getByTestId } = render(
        <CollapsibleSection title="Teste" defaultExpanded={false}>
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByTestId('icon-chevron-forward')).toBeTruthy();
    });

    it('deve mostrar chevron-down quando expandido', () => {
      const { getByTestId } = render(
        <CollapsibleSection title="Teste" defaultExpanded={true}>
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByTestId('icon-chevron-down')).toBeTruthy();
    });
  });

  describe('Comportamento de toggle', () => {
    it('deve começar recolhido por padrão', () => {
      const { queryByText } = render(
        <CollapsibleSection title="Teste">
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      // Conteúdo não deve ser visível quando recolhido
      expect(queryByText('Conteúdo interno')).toBeNull();
    });

    it('deve começar expandido quando defaultExpanded=true', () => {
      const { getByText } = render(
        <CollapsibleSection title="Teste" defaultExpanded={true}>
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      expect(getByText('Conteúdo interno')).toBeTruthy();
    });

    it('deve expandir ao clicar no header', () => {
      const { getByText, queryByText } = render(
        <CollapsibleSection title="Teste">
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      // Inicialmente recolhido
      expect(queryByText('Conteúdo interno')).toBeNull();

      // Clicar para expandir
      fireEvent.press(getByText('Teste'));

      // Agora deve estar visível
      expect(getByText('Conteúdo interno')).toBeTruthy();
    });

    it('deve recolher ao clicar novamente', () => {
      const { getByText, queryByText } = render(
        <CollapsibleSection title="Teste" defaultExpanded={true}>
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      // Inicialmente expandido
      expect(getByText('Conteúdo interno')).toBeTruthy();

      // Clicar para recolher
      fireEvent.press(getByText('Teste'));

      // Deve estar escondido
      expect(queryByText('Conteúdo interno')).toBeNull();
    });
  });

  describe('Ícone customizado', () => {
    it('deve renderizar ícone quando fornecido', () => {
      const { getByTestId } = render(
        <CollapsibleSection title="Teste" icon="person-outline">
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByTestId('icon-person-outline')).toBeTruthy();
    });
  });

  describe('Badge', () => {
    it('deve renderizar badge com número', () => {
      const { getByText } = render(
        <CollapsibleSection title="Itens" badge={5}>
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByText('5')).toBeTruthy();
    });

    it('deve renderizar badge com texto', () => {
      const { getByText } = render(
        <CollapsibleSection title="Status" badge="Novo">
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByText('Novo')).toBeTruthy();
    });

    it('não deve renderizar badge quando não fornecido', () => {
      const { queryByText } = render(
        <CollapsibleSection title="Teste">
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      // Badge não deve existir
      expect(queryByText('5')).toBeNull();
    });
  });

  describe('forceExpanded', () => {
    it('deve expandir automaticamente quando forceExpanded=true', () => {
      const { getByText, rerender } = render(
        <CollapsibleSection title="Teste" forceExpanded={false}>
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      // Re-render com forceExpanded=true
      rerender(
        <CollapsibleSection title="Teste" forceExpanded={true}>
          <Text>Conteúdo interno</Text>
        </CollapsibleSection>
      );

      // Agora deve estar expandido
      expect(getByText('Conteúdo interno')).toBeTruthy();
    });
  });

  describe('TestID', () => {
    it('deve aplicar testID quando fornecido', () => {
      const { getByTestId } = render(
        <CollapsibleSection title="Teste" testID="custom-section">
          <Text>Conteúdo</Text>
        </CollapsibleSection>
      );

      expect(getByTestId('custom-section')).toBeTruthy();
    });
  });
});
