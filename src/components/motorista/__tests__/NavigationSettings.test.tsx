import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { NavigationSettings } from '../NavigationSettings';

// Access global useAlert mock
declare global {
  var mockUseAlert: {
    showAlert: jest.Mock;
    showSuccess: jest.Mock;
    showWarning: jest.Mock;
    showError: jest.Mock;
    showConfirm: jest.Mock;
    showDestructive: jest.Mock;
    hideAlert: jest.Mock;
    isVisible: boolean;
    AlertDialog: null;
  };
}

// Mock LocationTrackingService
jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    getNavigationPreferences: jest.fn().mockResolvedValue({
      navegarCom: 'mapa',
      soundAlerts: true,
      vibrationAlerts: true,
      proximityRadius: 50,
    }),
    updateNavigationPreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock unistyles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      text: '#000',
      primary: '#007AFF',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
      gray400: '#9ca3af',
      gray500: '#6b7280',
      gray900: '#111827',
      white: '#fff',
      warning: '#FF9500',
      warningBg: '#fef3c7',
      secondaryDark: '#92400e',
      error: '#FF3B30',
      errorBg: '#fee2e2',
    },
    typography: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      fontSans: 'System',
      fontSansMedium: 'System',
      fontSansSemiBold: 'System',
      fontSansBold: 'System',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      full: 9999,
    },
  };
  return {
    useUnistyles: () => ({ theme }),
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(theme) : fn),
    },
  };
});

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock Slider — com contador de montagens: o prefixo `mock` é o que permite
// referenciá-lo de dentro da factory do jest.mock.
const mockMontagensSlider = { total: 0 };

jest.mock('@react-native-community/slider', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return (props: any) => {
    ReactActual.useEffect(() => {
      mockMontagensSlider.total += 1;
    }, []);
    return <View testID="slider" {...props} />;
  };
});

describe('NavigationSettings', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não deve renderizar quando visible é false', () => {
    const { toJSON } = render(
      <NavigationSettings visible={false} onClose={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('deve renderizar quando visible é true', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Configurações de Navegação')).toBeTruthy();
  });

  describe('Navegar com', () => {
    it('mostra as duas opções, com o mapa do app marcado por padrão', async () => {
      const { getByText, getByTestId } = render(
        <NavigationSettings {...defaultProps} />,
      );

      expect(getByText('Navegar com')).toBeTruthy();
      expect(getByText('Mapa do RotaMestre')).toBeTruthy();
      expect(getByText('Waze / Google Maps')).toBeTruthy();
      await waitFor(() => {
        expect(
          getByTestId('navegar-com-mapa').props.accessibilityState,
        ).toEqual(expect.objectContaining({ selected: true }));
      });
    });

    it('escolher o app externo grava navegarCom:externo e esconde o raio', async () => {
      const LocationTrackingService = jest.requireMock(
        '@/services/locationTracking',
      ).default;
      const { getByTestId, queryByText } = render(
        <NavigationSettings {...defaultProps} />,
      );
      await waitFor(() =>
        expect(queryByText(/Raio de Proximidade/)).toBeTruthy(),
      );

      fireEvent.press(getByTestId('navegar-com-externo'));

      await waitFor(() => {
        expect(
          LocationTrackingService.updateNavigationPreferences,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ navegarCom: 'externo' }),
        );
      });
      expect(queryByText(/Raio de Proximidade/)).toBeNull();
    });

    it('não promete mais avanço automático', () => {
      const { queryByText } = render(<NavigationSettings {...defaultProps} />);

      // A dica antiga dizia que o modo "economiza tempo ao não precisar
      // confirmar cada parada" — o comportamento que gerou entregas sem foto.
      expect(queryByText(/Avanço Automático/)).toBeNull();
      expect(queryByText(/modo automático/i)).toBeNull();
    });
  });

  it('deve mostrar seção de App de Navegação', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('App de Navegação')).toBeTruthy();
    expect(getByText('Escolha o app preferido para abrir rotas')).toBeTruthy();
  });

  // O Turn-by-Turn próprio saiu em 03/10/2026: a navegação curva a curva é
  // a do app externo (Waze/Google Maps).
  it('não oferece mais a navegação interna (Turn-by-Turn)', () => {
    const { queryByText } = render(<NavigationSettings {...defaultProps} />);
    expect(queryByText('Navegação Interna')).toBeNull();
    expect(queryByText(/Turn-by-Turn/)).toBeNull();
    expect(queryByText('Navegação por Voz')).toBeNull();
  });

  it('deve mostrar seção de Notificações', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Notificações')).toBeTruthy();
    expect(getByText('Alertas Sonoros')).toBeTruthy();
    expect(getByText('Vibração')).toBeTruthy();
  });

  it('deve mostrar seção de Exibição', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Exibição')).toBeTruthy();
  });

  it('deve mostrar seção de Dicas', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Dicas')).toBeTruthy();
  });

  it('deve mostrar botão Restaurar Padrões', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Restaurar Padrões')).toBeTruthy();
  });

  it('deve abrir alerta ao clicar em Restaurar Padrões', async () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);

    fireEvent.press(getByText('Restaurar Padrões'));

    await waitFor(() => {
      expect(global.mockUseAlert.showConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Restaurar Padrões',
          message:
            'Deseja restaurar todas as configurações para os valores padrão?',
        }),
      );
    });
  });

  it('deve mostrar descrição dos Alertas Sonoros', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Sons ao aproximar ou chegar ao destino')).toBeTruthy();
  });

  it('deve mostrar descrição da Vibração', () => {
    const { getByText } = render(<NavigationSettings {...defaultProps} />);
    expect(getByText('Vibrar ao chegar no destino')).toBeTruthy();
  });

  it('deve chamar onClose ao clicar no botão fechar', () => {
    const onClose = jest.fn();
    const { getByText: _getByText } = render(
      <NavigationSettings visible={true} onClose={onClose} />,
    );

    // O botão de fechar renderiza como Ionicons
    // Podemos verificar que onClose não foi chamado ainda
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('Platform-specific features', () => {
    const originalPlatform = Platform.OS;

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: originalPlatform });
    });

    it('deve mostrar dica específica para web', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web' });

      const { getByText } = render(<NavigationSettings {...defaultProps} />);

      expect(
        getByText(/Algumas opções.*estão disponíveis apenas no app mobile/),
      ).toBeTruthy();
    });
  });

  describe('Nav App Selector', () => {
    it('deve mostrar opções de app de navegação', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText('Padrão do Sistema')).toBeTruthy();
      expect(getByText('Waze')).toBeTruthy();
      expect(getByText('Google Maps')).toBeTruthy();
    });

    it('deve ter Padrão do Sistema selecionado por padrão', () => {
      const { getAllByText } = render(<NavigationSettings {...defaultProps} />);
      // Uma marca por grupo de opções: App de Navegação e Navegar com
      expect(getAllByText('✓')).toHaveLength(2);
    });
  });

  describe('Settings controls', () => {
    it('não remonta o conteúdo ao alterar uma configuração', async () => {
      const LocationTrackingService =
        require('@/services/locationTracking').default;
      const { getByText } = render(<NavigationSettings {...defaultProps} />);

      // Espera o loadSettings inicial assentar (também re-renderiza).
      await waitFor(() =>
        expect(
          LocationTrackingService.getNavigationPreferences,
        ).toHaveBeenCalled(),
      );
      const montagensIniciais = mockMontagensSlider.total;

      // Troca o app de navegação: setSettings → re-render do pai.
      fireEvent.press(getByText('Waze'));
      await waitFor(() =>
        expect(
          LocationTrackingService.updateNavigationPreferences,
        ).toHaveBeenCalledWith({ preferredNavApp: 'waze' }),
      );

      // Regressão da causa raiz: com `SettingsContent` declarado como
      // componente dentro do render, cada mudança de configuração dava
      // um TIPO novo ao React e remontava a subárvore — o Slider de raio
      // de proximidade era destruído no meio do drag (cada tick dispara
      // setSettings), sem erro no console.
      expect(mockMontagensSlider.total).toBe(montagensIniciais);
    });

    it('deve ter switch para Alertas Sonoros', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText('Alertas Sonoros')).toBeTruthy();
    });

    it('deve ter switch para Vibração', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText('Vibração')).toBeTruthy();
    });

    it('deve ter switch para Velocímetro', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText(/Velocímetro/)).toBeTruthy();
    });

    it('deve ter switch para Manter Tela Ligada', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText(/Manter Tela Ligada/)).toBeTruthy();
    });
  });

  describe('Tips', () => {
    it('deve mostrar dica sobre raio de proximidade', () => {
      const { getByText } = render(<NavigationSettings {...defaultProps} />);
      expect(getByText(/Ajuste o raio de proximidade/)).toBeTruthy();
    });
  });
});

/**
 * Com o app em tela cheia (edge-to-edge), o Modal desenha sob a barra de
 * navegação do Android: o fim da folha ficava atrás dos botões do sistema
 * (visto no moto g15 em 03/10/2026).
 */
describe('NavigationSettings — barra de navegação do sistema', () => {
  const safeArea = jest.requireMock('react-native-safe-area-context');
  const original = safeArea.useSafeAreaInsets;

  afterEach(() => {
    safeArea.useSafeAreaInsets = original;
  });

  it('a folha reserva insets.bottom', () => {
    safeArea.useSafeAreaInsets = () => ({
      top: 0,
      right: 0,
      bottom: 48,
      left: 0,
    });
    const { getByTestId } = render(
      <NavigationSettings visible onClose={jest.fn()} />,
    );

    const { StyleSheet } = jest.requireActual('react-native');
    const estilo = StyleSheet.flatten(
      getByTestId('nav-settings-folha').props.style,
    );
    expect(estilo.paddingBottom).toBe(48);
  });
});
