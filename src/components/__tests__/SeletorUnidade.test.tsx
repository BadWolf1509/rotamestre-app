/**
 * Tests for SeletorUnidade.tsx
 * Componente para seleção de unidade com trigger e modal
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import {
  SeletorUnidade,
  SeletorUnidadeTrigger,
} from '../SeletorUnidade';

// Mock useUnidadeAtiva hook
const mockUseUnidadeAtiva = jest.fn();

jest.mock('@/hooks/useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => mockUseUnidadeAtiva(),
}));

// Mock Modal component
jest.mock('../Modal', () => ({
  Modal: ({ children, visible, title }: any) => {
    const { View, Text } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="modal">
        <Text>{title}</Text>
        {children}
      </View>
    );
  },
}));

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      primary: '#284093',
      primaryLight: '#e8edfa',
      success: '#10b981',
      white: '#ffffff',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray600: '#4b5563',
      gray800: '#1f2937',
    },
    spacing: { xs: 4, sm: 8, md: 12, xl: 24 },
    borderRadius: { sm: 6, md: 10 },
    typography: {
      fontSans: 'NunitoSans_400Regular',
      fontSansMedium: 'NunitoSans_500Medium',
      fontSansBold: 'NunitoSans_700Bold',
      fontSize: { xs: 11, sm: 14, base: 16 },
    },
  };

  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: (t: typeof theme) => Record<string, unknown>) => fn(theme),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

describe('SeletorUnidade', () => {
  const mockVinculacoes = [
    {
      id: 'vinc-1',
      unidade_id: 'unidade-1',
      papel: 'gestor',
      is_principal: true,
      unidades: {
        id: 'unidade-1',
        nome: 'Unidade Principal',
        cidade: 'São Paulo',
      },
    },
    {
      id: 'vinc-2',
      unidade_id: 'unidade-2',
      papel: 'motorista',
      is_principal: false,
      unidades: {
        id: 'unidade-2',
        nome: 'Unidade Secundária',
        cidade: 'Rio de Janeiro',
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUnidadeAtiva.mockReturnValue({
      unidadeAtiva: 'unidade-1',
      unidadeAtivaData: mockVinculacoes[0].unidades,
      vinculacoes: mockVinculacoes,
      temMultiplasUnidades: true,
      trocarUnidade: jest.fn(),
      loading: false,
    });
  });

  describe('SeletorUnidadeTrigger', () => {
    it('should render unit name', () => {
      const { getByText } = render(<SeletorUnidadeTrigger onPress={jest.fn()} />);

      expect(getByText('Unidade Principal')).toBeTruthy();
    });

    it('should show loading indicator when loading', () => {
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: null,
        unidadeAtivaData: null,
        vinculacoes: [],
        temMultiplasUnidades: false,
        trocarUnidade: jest.fn(),
        loading: true,
      });

      const { UNSAFE_getByType } = render(
        <SeletorUnidadeTrigger onPress={jest.fn()} />
      );
      const ActivityIndicator = require('react-native').ActivityIndicator;

      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('should show chevron when multiple units available', () => {
      const { getByText } = render(<SeletorUnidadeTrigger onPress={jest.fn()} />);

      expect(getByText('chevron-down')).toBeTruthy();
    });

    it('should not show chevron when single unit', () => {
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: [mockVinculacoes[0]],
        temMultiplasUnidades: false,
        trocarUnidade: jest.fn(),
        loading: false,
      });

      const { queryByText } = render(
        <SeletorUnidadeTrigger onPress={jest.fn()} />
      );

      expect(queryByText('chevron-down')).toBeNull();
    });

    it('should call onPress when has multiple units', () => {
      const onPress = jest.fn();
      const { getByText } = render(<SeletorUnidadeTrigger onPress={onPress} />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(onPress).toHaveBeenCalled();
    });

    it('should show placeholder when no unit data', () => {
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: null,
        unidadeAtivaData: null,
        vinculacoes: [],
        temMultiplasUnidades: false,
        trocarUnidade: jest.fn(),
        loading: false,
      });

      const { getByText } = render(<SeletorUnidadeTrigger onPress={jest.fn()} />);

      expect(getByText('Selecione uma unidade')).toBeTruthy();
    });

    it('should show business-outline icon', () => {
      const { getByText } = render(<SeletorUnidadeTrigger onPress={jest.fn()} />);

      expect(getByText('business-outline')).toBeTruthy();
    });
  });

  describe('SeletorUnidade', () => {
    it('should render trigger component', () => {
      const { getByText } = render(<SeletorUnidade />);

      expect(getByText('Unidade Principal')).toBeTruthy();
    });

    it('should open modal when trigger pressed', () => {
      const { getByText, getByTestId } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByTestId('modal')).toBeTruthy();
      expect(getByText('Selecione a Unidade')).toBeTruthy();
    });

    it('should show all units in modal', () => {
      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByText('Unidade Secundária')).toBeTruthy();
    });

    it('should call trocarUnidade when selecting different unit', () => {
      const mockTrocarUnidade = jest.fn();
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: mockVinculacoes,
        temMultiplasUnidades: true,
        trocarUnidade: mockTrocarUnidade,
        loading: false,
      });

      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));
      fireEvent.press(getByText('Unidade Secundária'));

      expect(mockTrocarUnidade).toHaveBeenCalledWith('unidade-2');
    });

    it('should call onUnidadeChange callback when unit changes', async () => {
      const mockTrocarUnidade = jest.fn().mockResolvedValue(undefined);
      const mockOnChange = jest.fn();
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: mockVinculacoes,
        temMultiplasUnidades: true,
        trocarUnidade: mockTrocarUnidade,
        loading: false,
      });

      const { getByText } = render(
        <SeletorUnidade onUnidadeChange={mockOnChange} />
      );

      fireEvent.press(getByText('Unidade Principal'));
      fireEvent.press(getByText('Unidade Secundária'));

      // Wait for async trocarUnidade to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockOnChange).toHaveBeenCalledWith('unidade-2');
    });

    it('should not call trocarUnidade when selecting same unit', () => {
      const mockTrocarUnidade = jest.fn();
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: mockVinculacoes,
        temMultiplasUnidades: true,
        trocarUnidade: mockTrocarUnidade,
        loading: false,
      });

      const { getByText, getAllByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));
      // Click on "Unidade Principal" in the modal list
      const unidadePrincipalElements = getAllByText('Unidade Principal');
      fireEvent.press(unidadePrincipalElements[1]); // Second one is in the list

      expect(mockTrocarUnidade).not.toHaveBeenCalled();
    });

    it('should show loading indicator in trigger when loading', () => {
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: mockVinculacoes,
        temMultiplasUnidades: true,
        trocarUnidade: jest.fn(),
        loading: true,
      });

      const { UNSAFE_getByType } = render(<SeletorUnidade />);
      const ActivityIndicator = require('react-native').ActivityIndicator;

      // When loading, trigger shows ActivityIndicator
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('should not render when compact and single unit', () => {
      mockUseUnidadeAtiva.mockReturnValue({
        unidadeAtiva: 'unidade-1',
        unidadeAtivaData: mockVinculacoes[0].unidades,
        vinculacoes: [mockVinculacoes[0]],
        temMultiplasUnidades: false,
        trocarUnidade: jest.fn(),
        loading: false,
      });

      const { queryByText } = render(<SeletorUnidade compact />);

      expect(queryByText('Unidade Principal')).toBeNull();
    });

    it('should show unit papel (Gestor)', () => {
      const { getByText, getAllByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      const gestorElements = getAllByText('Gestor');
      expect(gestorElements.length).toBeGreaterThan(0);
    });

    it('should show unit papel (Motorista)', () => {
      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByText('Motorista')).toBeTruthy();
    });

    it('should show Principal badge for principal unit', () => {
      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByText('Principal')).toBeTruthy();
    });

    it('should show city for units', () => {
      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByText('São Paulo')).toBeTruthy();
      expect(getByText('Rio de Janeiro')).toBeTruthy();
    });

    it('should show checkmark for selected unit', () => {
      const { getByText } = render(<SeletorUnidade />);

      fireEvent.press(getByText('Unidade Principal'));

      expect(getByText('checkmark-circle')).toBeTruthy();
    });
  });
});
