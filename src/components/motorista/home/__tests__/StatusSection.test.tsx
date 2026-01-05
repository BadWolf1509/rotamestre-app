import { render } from '@testing-library/react-native';
import React from 'react';

import { StatusSection } from '../StatusSection';

// Mock styles - theme defined inside mock to avoid hoisting issues
jest.mock('@/utils/styles', () => {
  const mockTheme = {
    colors: {
      white: '#fff',
      primary: '#007AFF',
      success: '#10b981',
      warning: '#f59e0b',
      info: '#3b82f6',
      gray100: '#f3f4f6',
      gray200: '#e5e7eb',
      gray500: '#6b7280',
      gray700: '#374151',
      gray900: '#111827',
      successBg: '#d1fae5',
      warningBg: '#fef3c7',
      primaryLight: '#dbeafe',
      infoBg: '#dbeafe',
    },
    spacing: {
      sm: 8,
      md: 12,
      lg: 16,
      '1': 4,
      '1.5': 6,
      '2': 8,
      '2.5': 10,
    },
    borderRadius: {
      xs: 4,
      sm: 8,
      md: 10,
      lg: 12,
      xl: 16,
      full: 9999,
    },
    typography: {
      sm: 14,
      xs: 12,
      '2xl': 24,
      fontSize: {
        xs: 12,
        sm: 14,
      },
      fontDisplay: 'System',
      fontSansSemiBold: 'System',
      fontSansMedium: 'System',
    },
  };
  return {
    StyleSheet: {
      create: (fn: any) => (typeof fn === 'function' ? fn(mockTheme) : fn),
    },
    useUnistyles: () => ({ theme: mockTheme }),
  };
});

// Mock ConnectivityIndicator
jest.mock('@/components/ConnectivityBanner', () => ({
  ConnectivityIndicator: () => null,
}));

describe('StatusSection', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar com userName padrão "Motorista"', () => {
      const { getByText } = render(<StatusSection />);

      // Componente agora mostra saudação baseada na hora e o primeiro nome
      expect(getByText('Motorista')).toBeTruthy();
      // Deve mostrar saudação (Bom dia, Boa tarde ou Boa noite)
      expect(getByText(/Bom dia|Boa tarde|Boa noite/)).toBeTruthy();
    });

    it('deve renderizar status badge padrão "Sem rota"', () => {
      const { getByText } = render(<StatusSection />);

      expect(getByText('Sem rota')).toBeTruthy();
    });

    it('deve renderizar View container', () => {
      const { UNSAFE_getAllByType } = render(<StatusSection />);

      const { View } = require('react-native');
      expect(UNSAFE_getAllByType(View).length).toBeGreaterThan(0);
    });
  });

  describe('UserName Prop', () => {
    it('deve renderizar primeiro nome do userName', () => {
      const { getByText } = render(<StatusSection userName="João Silva" />);

      // Componente mostra apenas o primeiro nome
      expect(getByText('João')).toBeTruthy();
    });

    it('deve renderizar diferentes userNames', () => {
      const { getByText } = render(<StatusSection userName="Maria Santos" />);

      expect(getByText('Maria')).toBeTruthy();
    });

    it('deve renderizar primeiro nome com dois nomes', () => {
      const { getByText } = render(<StatusSection userName="José Carlos" />);

      // Componente simplificado mostra apenas o primeiro nome
      expect(getByText('José')).toBeTruthy();
    });
  });

  // Nota: unitName e avatar com iniciais foram removidos do componente simplificado

  describe('RouteStatus Prop', () => {
    it('deve renderizar status "pending" corretamente', () => {
      const { getByText } = render(
        <StatusSection routeStatus="pending" />
      );

      expect(getByText('Rota pendente')).toBeTruthy();
    });

    it('deve renderizar status "active" corretamente', () => {
      const { getByText } = render(
        <StatusSection routeStatus="active" />
      );

      expect(getByText('Em rota')).toBeTruthy();
    });

    it('deve renderizar status "last-stop" corretamente', () => {
      const { getByText } = render(
        <StatusSection routeStatus="last-stop" />
      );

      expect(getByText('Última parada')).toBeTruthy();
    });

    it('deve renderizar status "ready-to-complete" corretamente', () => {
      const { getByText } = render(
        <StatusSection routeStatus="ready-to-complete" />
      );

      expect(getByText('Pronto para finalizar')).toBeTruthy();
    });

    it('deve renderizar status "completed" corretamente', () => {
      const { getByText } = render(
        <StatusSection routeStatus="completed" />
      );

      expect(getByText('Rota concluída')).toBeTruthy();
    });
  });

  describe('Progress Indicator', () => {
    it('deve mostrar progresso quando em rota ativa', () => {
      const { getByText } = render(
        <StatusSection
          routeStatus="active"
          completedStops={3}
          totalStops={10}
        />
      );

      expect(getByText('3/10')).toBeTruthy();
    });

    it('deve mostrar progresso quando na última parada', () => {
      const { getByText } = render(
        <StatusSection
          routeStatus="last-stop"
          completedStops={9}
          totalStops={10}
        />
      );

      expect(getByText('9/10')).toBeTruthy();
    });

    it('não deve mostrar progresso quando no-route', () => {
      const { queryByText } = render(
        <StatusSection
          routeStatus="no-route"
          completedStops={3}
          totalStops={10}
        />
      );

      expect(queryByText('3/10')).toBeNull();
    });

    it('não deve mostrar progresso quando totalStops é 0', () => {
      const { queryByText } = render(
        <StatusSection
          routeStatus="active"
          completedStops={0}
          totalStops={0}
        />
      );

      expect(queryByText('0/0')).toBeNull();
    });
  });

  // Nota: UserPhoto e avatar com iniciais foram removidos do componente simplificado

  describe('Estrutura do Componente', () => {
    it('deve renderizar múltiplos Views aninhados', () => {
      const { UNSAFE_getAllByType } = render(
        <StatusSection userName="João" />
      );

      const { View } = require('react-native');
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThanOrEqual(2);
    });

    it('deve renderizar Text elements', () => {
      const { UNSAFE_getAllByType } = render(<StatusSection />);

      const { Text } = require('react-native');
      const texts = UNSAFE_getAllByType(Text);
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve renderizar tela inicial do motorista com userName', () => {
      const { getByText } = render(
        <StatusSection userName="João Silva" />
      );

      expect(getByText('João')).toBeTruthy();
    });

    it('deve renderizar primeiro nome de userName composto', () => {
      const { getByText } = render(<StatusSection userName="Maria Santos" />);

      expect(getByText('Maria')).toBeTruthy();
    });

    it('deve renderizar estado inicial sem dados do usuário', () => {
      const { getByText } = render(<StatusSection />);

      expect(getByText('Motorista')).toBeTruthy();
    });

    it('deve renderizar primeiro nome para nomes longos', () => {
      const { getByText } = render(
        <StatusSection userName="Carlos Oliveira Santos" />
      );

      expect(getByText('Carlos')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com userName vazio (usa default)', () => {
      const { getByText } = render(<StatusSection userName="" />);

      // userName vazio mostra string vazia (sem crash)
      expect(getByText(/Bom dia|Boa tarde|Boa noite/)).toBeTruthy();
    });

    it('deve renderizar com userName com caracteres especiais', () => {
      const { getByText } = render(
        <StatusSection userName="João & Maria" />
      );

      // Apenas primeiro nome é mostrado
      expect(getByText('João')).toBeTruthy();
    });
  });
});
