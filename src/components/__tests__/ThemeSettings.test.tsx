/**
 * Tests for ThemeSettings.tsx
 * Componente de configuracao de tema com modo escuro, densidade e contraste
 */

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { Alert, Platform } from 'react-native';

import { ThemeSettings } from '../ThemeSettings';

// Mock theme preferences
const mockGetThemePreferences = jest.fn();
const mockSetThemePreference = jest.fn();
const mockSetDensityPreference = jest.fn();
const mockSetContrastPreference = jest.fn();
const mockApplyThemePreferences = jest.fn();

jest.mock('@/lib/themePreference', () => ({
  getThemePreferences: () => mockGetThemePreferences(),
  setThemePreference: (pref: string) => mockSetThemePreference(pref),
  setDensityPreference: (pref: string) => mockSetDensityPreference(pref),
  setContrastPreference: (pref: string) => mockSetContrastPreference(pref),
  applyThemePreferences: (prefs: object) => mockApplyThemePreferences(prefs),
}));

// Mock theme
const mockTheme = {
  colors: {
    primary: '#284093',
    white: '#ffffff',
    surface: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    divider: '#e5e7eb',
    gray100: '#f3f4f6',
    gray300: '#d1d5db',
    successBg: '#d1fae5',
    success: '#10b981',
    card: '#ffffff',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
  typography: {
    fontSize: { xs: 12, sm: 14, base: 16 },
    fontSansMedium: 'System-Medium',
    fontSansSemiBold: 'System-SemiBold',
  },
  borderRadius: { sm: 8, lg: 12 },
  components: {
    button: {
      radius: 8,
      size: {
        small: { paddingHorizontal: 12, paddingVertical: 6, height: 32, fontSize: 12 },
        medium: { paddingHorizontal: 16, paddingVertical: 8, height: 40, fontSize: 14 },
      },
    },
    card: {
      padding: { small: 8, medium: 12 },
    },
    badge: {
      size: {
        small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
        medium: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 12 },
      },
    },
  },
};

jest.mock('@/utils/styles', () => ({
  useUnistyles: () => ({ theme: mockTheme }),
  StyleSheet: {
    create: () => ({
      container: {},
      loadingText: {},
      title: {},
      settingRow: {},
      settingRowLast: {},
      settingInfo: {},
      settingText: {},
      settingLabel: {},
      settingDescription: {},
      previewSection: {},
      previewTitle: {},
      previewContainer: {},
      previewItem: {},
      previewLabel: {},
      sampleButton: {},
      sampleButtonText: {},
      sampleCard: {},
      sampleCardTitle: {},
      sampleCardText: {},
      sampleBadge: {},
      sampleBadgeText: {},
      resetButton: {},
      resetButtonText: {},
    }),
  },
  type: { Theme: {} },
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require('react-native');
    return <Text testID={testID || `icon-${name}`}>{name}</Text>;
  },
}));

// Mock ConfirmDialog
jest.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: ({ visible, title, message, onConfirm, onCancel }: {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    if (!visible) return null;
    return (
      <View testID="confirm-dialog">
        <Text>{title}</Text>
        <Text>{message}</Text>
        <TouchableOpacity testID="confirm-reset" onPress={onConfirm}>
          <Text>Restaurar</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="cancel-reset" onPress={onCancel}>
          <Text>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

// Mock Text from design-system
jest.mock('@/design-system', () => ({
  Text: ({ children, style }: { children: React.ReactNode; style?: object }) => {
    const { Text: RNText } = require('react-native');
    return <RNText style={style}>{children}</RNText>;
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ThemeSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetThemePreferences.mockResolvedValue({
      mode: 'light',
      density: 'regular',
      contrast: 'normal',
    });
    mockSetThemePreference.mockResolvedValue(undefined);
    mockSetDensityPreference.mockResolvedValue(undefined);
    mockSetContrastPreference.mockResolvedValue(undefined);
    Platform.OS = 'ios';
  });

  describe('Renderizacao', () => {
    it('deve exibir loading inicialmente', async () => {
      // Delay the resolution to catch loading state
      mockGetThemePreferences.mockImplementation(() => new Promise(() => {}));

      const { getByText } = render(<ThemeSettings />);

      expect(getByText('Carregando...')).toBeTruthy();
    });

    it('deve renderizar titulo apos carregar', async () => {
      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Aparência')).toBeTruthy();
      });
    });

    it('deve renderizar todas as opcoes de configuracao', async () => {
      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Tema escuro')).toBeTruthy();
        expect(getByText('Modo compacto')).toBeTruthy();
        expect(getByText('Alto contraste')).toBeTruthy();
      });
    });

    it('deve renderizar descricoes das opcoes', async () => {
      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Reduz o brilho em ambientes escuros')).toBeTruthy();
        expect(getByText('Reduz espaçamentos para mostrar mais informação')).toBeTruthy();
        expect(getByText('Aumenta contraste para melhor legibilidade')).toBeTruthy();
      });
    });
  });

  describe('Preview Section', () => {
    it('deve exibir preview por padrao', async () => {
      const { getByText, getAllByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Visualização')).toBeTruthy();
        // Elements may appear multiple times - once in sample and once in label
        expect(getAllByText('Botão').length).toBeGreaterThan(0);
        expect(getAllByText('Card').length).toBeGreaterThan(0);
        expect(getAllByText('Badge').length).toBeGreaterThan(0);
      });
    });

    it('nao deve exibir preview quando showPreview=false', async () => {
      const { queryByText } = render(<ThemeSettings showPreview={false} />);

      await waitFor(() => {
        expect(queryByText('Visualização')).toBeNull();
      });
    });
  });

  describe('Toggle de Tema Escuro', () => {
    it('deve chamar setThemePreference ao ativar tema escuro', async () => {
      const onSettingsChange = jest.fn();
      const { getAllByRole } = render(
        <ThemeSettings onSettingsChange={onSettingsChange} />
      );

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(0);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[0], 'valueChange', true);
      });

      await waitFor(() => {
        expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
      });
    });

    it('deve chamar onSettingsChange ao mudar tema', async () => {
      const onSettingsChange = jest.fn();
      const { getAllByRole } = render(
        <ThemeSettings onSettingsChange={onSettingsChange} />
      );

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(0);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[0], 'valueChange', true);
      });

      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({ mode: 'dark' })
        );
      });
    });

    it('deve reverter e mostrar alerta em caso de erro', async () => {
      mockSetThemePreference.mockRejectedValueOnce(new Error('Failed'));

      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(0);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[0], 'valueChange', true);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao salvar preferência de tema.');
      });
    });
  });

  describe('Toggle de Densidade', () => {
    it('deve chamar setDensityPreference ao ativar modo compacto', async () => {
      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(1);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[1], 'valueChange', true);
      });

      await waitFor(() => {
        expect(mockSetDensityPreference).toHaveBeenCalledWith('compact');
      });
    });

    it('deve reverter e mostrar alerta em caso de erro', async () => {
      mockSetDensityPreference.mockRejectedValueOnce(new Error('Failed'));

      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(1);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[1], 'valueChange', true);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao salvar preferência de densidade.');
      });
    });
  });

  describe('Toggle de Contraste', () => {
    it('deve chamar setContrastPreference ao ativar alto contraste', async () => {
      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(2);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[2], 'valueChange', true);
      });

      await waitFor(() => {
        expect(mockSetContrastPreference).toHaveBeenCalledWith('high');
      });
    });

    it('deve reverter e mostrar alerta em caso de erro', async () => {
      mockSetContrastPreference.mockRejectedValueOnce(new Error('Failed'));

      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBeGreaterThan(2);
      });

      const switches = getAllByRole('switch');
      await act(async () => {
        fireEvent(switches[2], 'valueChange', true);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Falha ao salvar preferência de contraste.');
      });
    });
  });

  describe('Botao Reset', () => {
    it('nao deve exibir botao reset quando nao ha mudancas', async () => {
      const { queryByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(queryByText('Restaurar padrões')).toBeNull();
      });
    });

    it('deve exibir botao reset quando ha mudancas', async () => {
      // Start with non-default preferences
      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      });

      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Restaurar padrões')).toBeTruthy();
      });
    });

    it('deve mostrar Alert ao clicar reset em mobile', async () => {
      Platform.OS = 'ios';

      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      });

      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Restaurar padrões')).toBeTruthy();
      });

      fireEvent.press(getByText('Restaurar padrões'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Restaurar padrões',
        'Tem certeza que deseja restaurar as configurações de aparência para os valores padrão?',
        expect.any(Array)
      );
    });

    it('deve mostrar ConfirmDialog ao clicar reset em web', async () => {
      Platform.OS = 'web' as typeof Platform.OS;

      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      });

      const { getByText, getByTestId } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Restaurar padrões')).toBeTruthy();
      });

      fireEvent.press(getByText('Restaurar padrões'));

      await waitFor(() => {
        expect(getByTestId('confirm-dialog')).toBeTruthy();
      });
    });

    it('deve restaurar padroes ao confirmar em web', async () => {
      Platform.OS = 'web' as typeof Platform.OS;

      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'compact',
        contrast: 'high',
      });

      const onSettingsChange = jest.fn();
      const { getByText, getByTestId } = render(
        <ThemeSettings onSettingsChange={onSettingsChange} />
      );

      await waitFor(() => {
        expect(getByText('Restaurar padrões')).toBeTruthy();
      });

      fireEvent.press(getByText('Restaurar padrões'));

      await waitFor(() => {
        expect(getByTestId('confirm-dialog')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('confirm-reset'));
      });

      await waitFor(() => {
        expect(mockApplyThemePreferences).toHaveBeenCalled();
        expect(mockSetThemePreference).toHaveBeenCalledWith('light');
        expect(mockSetDensityPreference).toHaveBeenCalledWith('regular');
        expect(mockSetContrastPreference).toHaveBeenCalledWith('normal');
      });
    });

    it('deve cancelar reset e fechar dialog', async () => {
      Platform.OS = 'web' as typeof Platform.OS;

      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'regular',
        contrast: 'normal',
      });

      const { getByText, getByTestId, queryByTestId } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Restaurar padrões')).toBeTruthy();
      });

      fireEvent.press(getByText('Restaurar padrões'));

      await waitFor(() => {
        expect(getByTestId('confirm-dialog')).toBeTruthy();
      });

      fireEvent.press(getByTestId('cancel-reset'));

      await waitFor(() => {
        expect(queryByTestId('confirm-dialog')).toBeNull();
      });
    });
  });

  describe('Modo Compacto', () => {
    it('deve renderizar com layout compacto', async () => {
      const { getByText } = render(<ThemeSettings compact={true} />);

      await waitFor(() => {
        expect(getByText('Aparência')).toBeTruthy();
      });
    });
  });

  describe('Carregamento de Preferencias', () => {
    it('deve carregar preferencias salvas', async () => {
      mockGetThemePreferences.mockResolvedValueOnce({
        mode: 'dark',
        density: 'compact',
        contrast: 'high',
      });

      const { getAllByRole } = render(<ThemeSettings />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        expect(switches.length).toBe(3);
        // First switch (dark mode) should be enabled
        expect(switches[0].props.value).toBe(true);
        // Second switch (compact) should be enabled
        expect(switches[1].props.value).toBe(true);
        // Third switch (high contrast) should be enabled
        expect(switches[2].props.value).toBe(true);
      });
    });

    it('deve lidar com erro ao carregar preferencias', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockGetThemePreferences.mockRejectedValueOnce(new Error('Failed to load'));

      const { getByText } = render(<ThemeSettings />);

      await waitFor(() => {
        expect(getByText('Aparência')).toBeTruthy();
      });

      consoleSpy.mockRestore();
    });
  });
});
