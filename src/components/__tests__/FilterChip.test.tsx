/**
 * Tests for FilterChip.tsx
 * Componente de chip de filtro selecionável
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { FilterChip } from '../FilterChip';

// Mock styles
jest.mock('@/utils/styles', () => ({
  StyleSheet: {
    create: () => ({
      base: {},
      compact: {},
      active: {},
      text: {},
      textCompact: {},
      textActive: {},
    }),
  },
  type: { Theme: {} },
}));

describe('FilterChip', () => {
  describe('Renderizacao basica', () => {
    it('deve renderizar label', () => {
      const { getByText } = render(<FilterChip label="Status" />);

      expect(getByText('Status')).toBeTruthy();
    });

    it('deve ter accessibilityLabel', () => {
      const { getByLabelText } = render(<FilterChip label="Filtrar" />);

      expect(getByLabelText('Filtrar')).toBeTruthy();
    });

    it('deve ter accessibilityRole button', () => {
      const { getByRole } = render(<FilterChip label="Filtrar" />);

      expect(getByRole('button')).toBeTruthy();
    });
  });

  describe('Estado selecionado', () => {
    it('nao deve estar selecionado por padrao', () => {
      const { getByRole } = render(<FilterChip label="Filtrar" />);

      const chip = getByRole('button');
      expect(chip.props.accessibilityState.selected).toBe(false);
    });

    it('deve estar selecionado quando selected=true', () => {
      const { getByRole } = render(<FilterChip label="Filtrar" selected={true} />);

      const chip = getByRole('button');
      expect(chip.props.accessibilityState.selected).toBe(true);
    });

    it('deve ter hint correto quando nao selecionado', () => {
      const { getByRole } = render(<FilterChip label="Filtrar" selected={false} />);

      const chip = getByRole('button');
      expect(chip.props.accessibilityHint).toBe('Toque para aplicar filtro');
    });

    it('deve ter hint correto quando selecionado', () => {
      const { getByRole } = render(<FilterChip label="Filtrar" selected={true} />);

      const chip = getByRole('button');
      expect(chip.props.accessibilityHint).toBe('Toque para desmarcar filtro');
    });
  });

  describe('Tamanhos', () => {
    it('deve usar tamanho regular por padrao', () => {
      const { getByText } = render(<FilterChip label="Regular" />);

      expect(getByText('Regular')).toBeTruthy();
    });

    it('deve aceitar tamanho compact', () => {
      const { getByText } = render(<FilterChip label="Compact" size="compact" />);

      expect(getByText('Compact')).toBeTruthy();
    });
  });

  describe('Estilos customizados', () => {
    it('deve aplicar containerStyle', () => {
      const customStyle = { marginTop: 10 };
      const { getByRole } = render(
        <FilterChip label="Custom" containerStyle={customStyle} />
      );

      const chip = getByRole('button');
      // Style can be flattened or as array
      expect(chip.props.style).toEqual(
        expect.objectContaining(customStyle)
      );
    });

    it('deve aplicar labelStyle', () => {
      const customLabelStyle = { fontWeight: 'bold' as const };
      const { getByText } = render(
        <FilterChip label="Styled" labelStyle={customLabelStyle} />
      );

      const label = getByText('Styled');
      expect(label.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customLabelStyle)])
      );
    });
  });

  describe('Interacao', () => {
    it('deve chamar onPress quando pressionado', () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <FilterChip label="Clicavel" onPress={onPress} />
      );

      fireEvent.press(getByRole('button'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('deve passar props adicionais para TouchableOpacity', () => {
      const onPress = jest.fn();
      const { getByRole } = render(
        <FilterChip label="Test" onPress={onPress} testID="test-chip" />
      );

      const chip = getByRole('button');
      fireEvent.press(chip);
      expect(onPress).toHaveBeenCalled();
    });
  });

  describe('Combinacoes', () => {
    it('deve combinar selected com compact', () => {
      const { getByRole, getByText } = render(
        <FilterChip label="Combo" selected={true} size="compact" />
      );

      const chip = getByRole('button');
      expect(chip.props.accessibilityState.selected).toBe(true);
      expect(getByText('Combo')).toBeTruthy();
    });

    it('deve combinar todos os estilos customizados', () => {
      const containerStyle = { margin: 5 };
      const labelStyle = { letterSpacing: 1 };
      const onPress = jest.fn();

      const { getByRole, getByText } = render(
        <FilterChip
          label="Full"
          selected={true}
          size="compact"
          containerStyle={containerStyle}
          labelStyle={labelStyle}
          onPress={onPress}
        />
      );

      fireEvent.press(getByRole('button'));
      expect(onPress).toHaveBeenCalled();
      expect(getByText('Full')).toBeTruthy();
    });
  });
});
