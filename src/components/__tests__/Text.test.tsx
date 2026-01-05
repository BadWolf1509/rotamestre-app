/**
 * Tests for Text.tsx
 * Componente de texto com variantes e tons
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { Text } from '../Text';

// Mock theme
const mockTheme = {
  colors: {
    primary: '#284093',
    success: '#10b981',
    warning: '#f7a02a',
    error: '#ef4444',
    white: '#ffffff',
    gray600: '#4b5563',
    gray900: '#111827',
  },
  typography: {
    fontSans: 'System',
    fontSansBold: 'System-Bold',
    fontSansSemiBold: 'System-SemiBold',
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
    },
  },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  StyleSheet: {
    create: () => ({
      base: {},
      body: {},
      title: {},
      subtitle: {},
      label: {},
      caption: {},
    }),
  },
  type: { Theme: {} },
}));

describe('Text', () => {
  describe('Renderizacao basica', () => {
    it('deve renderizar texto', () => {
      const { getByText } = render(<Text>Hello World</Text>);

      expect(getByText('Hello World')).toBeTruthy();
    });

    it('deve usar variante body por padrao', () => {
      const { getByText } = render(<Text>Body text</Text>);

      expect(getByText('Body text')).toBeTruthy();
    });

    it('deve usar tom default por padrao', () => {
      const { getByText } = render(<Text>Default tone</Text>);

      const text = getByText('Default tone');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.gray900 }),
        ])
      );
    });
  });

  describe('Variantes', () => {
    it('deve aplicar variante body', () => {
      const { getByText } = render(<Text variant="body">Body</Text>);

      expect(getByText('Body')).toBeTruthy();
    });

    it('deve aplicar variante title', () => {
      const { getByText } = render(<Text variant="title">Title</Text>);

      expect(getByText('Title')).toBeTruthy();
    });

    it('deve aplicar variante subtitle', () => {
      const { getByText } = render(<Text variant="subtitle">Subtitle</Text>);

      expect(getByText('Subtitle')).toBeTruthy();
    });

    it('deve aplicar variante label', () => {
      const { getByText } = render(<Text variant="label">Label</Text>);

      expect(getByText('Label')).toBeTruthy();
    });

    it('deve aplicar variante caption', () => {
      const { getByText } = render(<Text variant="caption">Caption</Text>);

      expect(getByText('Caption')).toBeTruthy();
    });
  });

  describe('Tons de cor', () => {
    it('deve aplicar tom default (gray900)', () => {
      const { getByText } = render(<Text tone="default">Default</Text>);

      const text = getByText('Default');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.gray900 }),
        ])
      );
    });

    it('deve aplicar tom muted (gray600)', () => {
      const { getByText } = render(<Text tone="muted">Muted</Text>);

      const text = getByText('Muted');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.gray600 }),
        ])
      );
    });

    it('deve aplicar tom primary', () => {
      const { getByText } = render(<Text tone="primary">Primary</Text>);

      const text = getByText('Primary');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.primary }),
        ])
      );
    });

    it('deve aplicar tom success', () => {
      const { getByText } = render(<Text tone="success">Success</Text>);

      const text = getByText('Success');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.success }),
        ])
      );
    });

    it('deve aplicar tom warning', () => {
      const { getByText } = render(<Text tone="warning">Warning</Text>);

      const text = getByText('Warning');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.warning }),
        ])
      );
    });

    it('deve aplicar tom error', () => {
      const { getByText } = render(<Text tone="error">Error</Text>);

      const text = getByText('Error');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.error }),
        ])
      );
    });

    it('deve aplicar tom inverse (white)', () => {
      const { getByText } = render(<Text tone="inverse">Inverse</Text>);

      const text = getByText('Inverse');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.white }),
        ])
      );
    });
  });

  describe('Estilos customizados', () => {
    it('deve aplicar style customizado', () => {
      const customStyle = { fontWeight: 'bold' as const };
      const { getByText } = render(<Text style={customStyle}>Custom</Text>);

      const text = getByText('Custom');
      expect(text.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });
  });

  describe('Props adicionais', () => {
    it('deve passar numberOfLines', () => {
      const { getByText } = render(
        <Text numberOfLines={2}>Truncated text</Text>
      );

      const text = getByText('Truncated text');
      expect(text.props.numberOfLines).toBe(2);
    });

    it('deve passar testID', () => {
      const { getByTestId } = render(<Text testID="my-text">Test</Text>);

      expect(getByTestId('my-text')).toBeTruthy();
    });
  });

  describe('Combinacoes', () => {
    it('deve combinar variante title com tom primary', () => {
      const { getByText } = render(
        <Text variant="title" tone="primary">
          Primary Title
        </Text>
      );

      const text = getByText('Primary Title');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.primary }),
        ])
      );
    });

    it('deve combinar variante caption com tom muted', () => {
      const { getByText } = render(
        <Text variant="caption" tone="muted">
          Muted Caption
        </Text>
      );

      const text = getByText('Muted Caption');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.gray600 }),
        ])
      );
    });

    it('deve combinar variante, tom e estilo customizado', () => {
      const customStyle = { marginTop: 10 };
      const { getByText } = render(
        <Text variant="label" tone="success" style={customStyle}>
          Combined
        </Text>
      );

      const text = getByText('Combined');
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: mockTheme.colors.success }),
          expect.objectContaining(customStyle),
        ])
      );
    });
  });
});
