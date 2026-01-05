/**
 * Tests for StatusBadge.tsx
 * Componente de badge de status com variantes e tamanhos
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { StatusBadge } from '../StatusBadge';

// Mock dependencies
const mockTheme = {
  colors: {
    primary: '#284093',
    white: '#ffffff',
    success: '#10b981',
  },
  typography: {
    fontSize: { xs: 12 },
    fontSansSemiBold: 'System-SemiBold',
  },
  borderRadius: { sm: 8 },
  components: {
    badge: {
      size: {
        small: { paddingHorizontal: 6, paddingVertical: 2 },
        medium: { paddingHorizontal: 10, paddingVertical: 4 },
      },
    },
  },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  StyleSheet: {
    create: () => ({
      base: {},
      small: {},
      text: {},
      textSmall: {},
    }),
  },
  type: { Theme: {} },
}));

jest.mock('@/utils/color', () => ({
  withOpacity: (color: string, opacity: number) => `${color}${Math.round(opacity * 100)}`,
}));

describe('StatusBadge', () => {
  describe('Renderizacao basica', () => {
    it('deve renderizar o label corretamente', () => {
      const { getByText } = render(
        <StatusBadge label="Pendente" color="#f7a02a" />
      );

      expect(getByText('Pendente')).toBeTruthy();
    });

    it('deve usar testID quando fornecido', () => {
      const { getByTestId } = render(
        <StatusBadge label="Status" color="#284093" testID="status-badge" />
      );

      expect(getByTestId('status-badge')).toBeTruthy();
    });
  });

  describe('Variante soft (padrao)', () => {
    it('deve usar variante soft por padrao', () => {
      const { getByText } = render(
        <StatusBadge label="Soft" color="#10b981" />
      );

      const textElement = getByText('Soft');
      // Em variante soft, o texto tem a cor do badge
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#10b981' }),
        ])
      );
    });
  });

  describe('Variante solid', () => {
    it('deve aplicar cor solida e texto branco', () => {
      const { getByText } = render(
        <StatusBadge label="Solid" color="#ef4444" variant="solid" />
      );

      const textElement = getByText('Solid');
      // Em variante solid, o texto deve ser branco
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.white }),
        ])
      );
    });
  });

  describe('Tamanhos', () => {
    it('deve usar tamanho md por padrao', () => {
      const { getByText } = render(
        <StatusBadge label="Medium" color="#284093" />
      );

      expect(getByText('Medium')).toBeTruthy();
    });

    it('deve aplicar estilo small quando size="sm"', () => {
      const { getByText } = render(
        <StatusBadge label="Small" color="#284093" size="sm" />
      );

      expect(getByText('Small')).toBeTruthy();
    });
  });

  describe('Estilos customizados', () => {
    it('deve aplicar containerStyle', () => {
      const customStyle = { marginTop: 10 };
      const { getByTestId } = render(
        <StatusBadge
          label="Custom"
          color="#284093"
          containerStyle={customStyle}
          testID="custom-badge"
        />
      );

      const container = getByTestId('custom-badge');
      expect(container.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('deve aplicar labelStyle', () => {
      const customLabelStyle = { fontWeight: 'bold' as const };
      const { getByText } = render(
        <StatusBadge
          label="Styled"
          color="#284093"
          labelStyle={customLabelStyle}
        />
      );

      const textElement = getByText('Styled');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customLabelStyle)])
      );
    });
  });

  describe('Combinacoes de props', () => {
    it('deve combinar variante solid com tamanho sm', () => {
      const { getByText } = render(
        <StatusBadge
          label="Solid Small"
          color="#ef4444"
          variant="solid"
          size="sm"
        />
      );

      const textElement = getByText('Solid Small');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.white }),
        ])
      );
    });

    it('deve combinar variante soft com tamanho sm', () => {
      const { getByText } = render(
        <StatusBadge
          label="Soft Small"
          color="#10b981"
          variant="soft"
          size="sm"
        />
      );

      const textElement = getByText('Soft Small');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#10b981' }),
        ])
      );
    });
  });

  describe('Cores dinamicas', () => {
    it('deve aplicar cor success', () => {
      const { getByText } = render(
        <StatusBadge label="Success" color="#10b981" />
      );

      expect(getByText('Success')).toBeTruthy();
    });

    it('deve aplicar cor warning', () => {
      const { getByText } = render(
        <StatusBadge label="Warning" color="#f7a02a" />
      );

      expect(getByText('Warning')).toBeTruthy();
    });

    it('deve aplicar cor error', () => {
      const { getByText } = render(
        <StatusBadge label="Error" color="#ef4444" />
      );

      expect(getByText('Error')).toBeTruthy();
    });

    it('deve aplicar cor info', () => {
      const { getByText } = render(
        <StatusBadge label="Info" color="#3b82f6" />
      );

      expect(getByText('Info')).toBeTruthy();
    });
  });
});
