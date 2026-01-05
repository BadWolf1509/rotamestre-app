/**
 * Tests for Icon.tsx
 * Componente de icone com tons e tamanhos
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { Icon } from '../Icon';

// Mock theme
const mockTheme = {
  colors: {
    primary: '#284093',
    success: '#10b981',
    warning: '#f7a02a',
    error: '#ef4444',
    white: '#ffffff',
    gray500: '#6b7280',
    gray700: '#374151',
  },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  type: { Theme: {} },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: { name: string; size: number; color: string }) => {
    const { View } = require('react-native');
    return (
      <View testID="icon" accessibilityLabel={`${name}-${size}-${color}`}>
        {name}
      </View>
    );
  },
}));

describe('Icon', () => {
  describe('Renderizacao basica', () => {
    it('deve renderizar icone com props padrao', () => {
      const { getByTestId } = render(<Icon name="home" />);

      const icon = getByTestId('icon');
      expect(icon).toBeTruthy();
      // Default size is 'md' (20) and tone is 'default' (gray700)
      expect(icon.props.accessibilityLabel).toBe('home-20-#374151');
    });
  });

  describe('Tamanhos', () => {
    it('deve aplicar tamanho sm (16)', () => {
      const { getByTestId } = render(<Icon name="star" size="sm" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('-16-');
    });

    it('deve aplicar tamanho md (20)', () => {
      const { getByTestId } = render(<Icon name="star" size="md" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('-20-');
    });

    it('deve aplicar tamanho lg (24)', () => {
      const { getByTestId } = render(<Icon name="star" size="lg" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('-24-');
    });

    it('deve aplicar tamanho xl (32)', () => {
      const { getByTestId } = render(<Icon name="star" size="xl" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('-32-');
    });

    it('deve aceitar tamanho numerico', () => {
      const { getByTestId } = render(<Icon name="star" size={48} />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('-48-');
    });
  });

  describe('Tons de cor', () => {
    it('deve aplicar tom default (gray700)', () => {
      const { getByTestId } = render(<Icon name="home" tone="default" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.gray700);
    });

    it('deve aplicar tom muted (gray500)', () => {
      const { getByTestId } = render(<Icon name="home" tone="muted" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.gray500);
    });

    it('deve aplicar tom primary', () => {
      const { getByTestId } = render(<Icon name="home" tone="primary" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.primary);
    });

    it('deve aplicar tom success', () => {
      const { getByTestId } = render(<Icon name="home" tone="success" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.success);
    });

    it('deve aplicar tom warning', () => {
      const { getByTestId } = render(<Icon name="home" tone="warning" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.warning);
    });

    it('deve aplicar tom error', () => {
      const { getByTestId } = render(<Icon name="home" tone="error" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.error);
    });

    it('deve aplicar tom inverse (white)', () => {
      const { getByTestId } = render(<Icon name="home" tone="inverse" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(mockTheme.colors.white);
    });
  });

  describe('Cor customizada', () => {
    it('deve usar cor customizada quando fornecida', () => {
      const customColor = '#ff0000';
      const { getByTestId } = render(<Icon name="home" color={customColor} />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain(customColor);
    });

    it('deve sobrescrever tom quando cor customizada fornecida', () => {
      const customColor = '#00ff00';
      const { getByTestId } = render(
        <Icon name="home" tone="error" color={customColor} />
      );

      const icon = getByTestId('icon');
      // Custom color should override tone
      expect(icon.props.accessibilityLabel).toContain(customColor);
      expect(icon.props.accessibilityLabel).not.toContain(mockTheme.colors.error);
    });
  });

  describe('Diferentes icones', () => {
    it('deve renderizar icone home', () => {
      const { getByTestId } = render(<Icon name="home" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('home');
    });

    it('deve renderizar icone star', () => {
      const { getByTestId } = render(<Icon name="star" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('star');
    });

    it('deve renderizar icone settings', () => {
      const { getByTestId } = render(<Icon name="settings" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('settings');
    });

    it('deve renderizar icone checkmark', () => {
      const { getByTestId } = render(<Icon name="checkmark" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toContain('checkmark');
    });
  });

  describe('Combinacoes', () => {
    it('deve combinar tamanho lg com tom success', () => {
      const { getByTestId } = render(<Icon name="checkmark" size="lg" tone="success" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toBe(`checkmark-24-${mockTheme.colors.success}`);
    });

    it('deve combinar tamanho numerico com cor customizada', () => {
      const { getByTestId } = render(<Icon name="alert" size={28} color="#123456" />);

      const icon = getByTestId('icon');
      expect(icon.props.accessibilityLabel).toBe('alert-28-#123456');
    });
  });
});
