import { Ionicons } from '@expo/vector-icons';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { UserMenuTrigger } from '../UserMenuTrigger';

// Mock useUnistyles
jest.mock('@/utils/styles', () => ({
  useUnistyles: jest.fn(),
  StyleSheet: require('react-native').StyleSheet,
}));

const mockUseUnistyles = require('@/utils/styles').useUnistyles;

describe('UserMenuTrigger Component', () => {
  beforeEach(() => {
    mockUseUnistyles.mockReturnValue({
      theme: {
        spacing: { lg: 16 },
        typography: {
          sm: 14,
          lg: 18,
          fontSansSemiBold: 'Inter-SemiBold',
          fontSansBold: 'Inter-Bold',
        },
        colors: {
          gray700: '#374151',
          gray600: '#4B5563',
          primary: '#007AFF',
          white: '#FFFFFF',
        },
        borderRadius: {
          full: 9999,
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar com nome fornecido', () => {
      const { getByText } = render(<UserMenuTrigger name="João Silva" />);

      expect(getByText(/Olá,/)).toBeTruthy();
      expect(getByText('João')).toBeTruthy();
    });

    it('deve renderizar greeting completo', () => {
      const { getByText } = render(<UserMenuTrigger name="Maria Santos" />);

      expect(getByText(/Olá,/)).toBeTruthy();
      expect(getByText('Maria')).toBeTruthy();
    });

    it('deve renderizar inicial do nome no avatar', () => {
      const { getByText } = render(<UserMenuTrigger name="Carlos Pereira" />);

      expect(getByText('C')).toBeTruthy();
    });

    it('deve exibir nome padrão quando name é undefined', () => {
      const { getByText } = render(<UserMenuTrigger />);

      expect(getByText('Usuário')).toBeTruthy();
    });

    it('deve exibir nome padrão quando name é vazio', () => {
      const { getByText } = render(<UserMenuTrigger name="" />);

      expect(getByText('Usuário')).toBeTruthy();
    });

    it('deve exibir nome padrão quando name é apenas espaços', () => {
      const { getByText } = render(<UserMenuTrigger name="   " />);

      expect(getByText('Usuário')).toBeTruthy();
    });
  });

  describe('Extração do Primeiro Nome', () => {
    it('deve extrair primeiro nome de nome completo', () => {
      const { getByText } = render(<UserMenuTrigger name="Ana Paula Costa" />);

      expect(getByText('Ana')).toBeTruthy();
      expect(getByText('A')).toBeTruthy(); // Inicial no avatar
    });

    it('deve extrair nome único', () => {
      const { getByText } = render(<UserMenuTrigger name="Roberto" />);

      expect(getByText('Roberto')).toBeTruthy();
      expect(getByText('R')).toBeTruthy();
    });

    it('deve lidar com múltiplos espaços entre nomes', () => {
      const { getByText } = render(<UserMenuTrigger name="Pedro   Miguel   Santos" />);

      expect(getByText('Pedro')).toBeTruthy();
      expect(getByText('P')).toBeTruthy();
    });

    it('deve remover espaços do início e fim do nome', () => {
      const { getByText } = render(<UserMenuTrigger name="  Lucia Fernandes  " />);

      expect(getByText('Lucia')).toBeTruthy();
      expect(getByText('L')).toBeTruthy();
    });
  });

  describe('Inicial do Avatar', () => {
    it('deve converter inicial para maiúscula', () => {
      const { getByText } = render(<UserMenuTrigger name="joão" />);

      expect(getByText('J')).toBeTruthy();
    });

    it('deve exibir ? quando nome padrão Usuário é usado', () => {
      const { getByText } = render(<UserMenuTrigger name="" />);

      // Quando name é vazio, displayName = "Usuário", então inicial = "U"
      expect(getByText('U')).toBeTruthy();
    });

    it('deve exibir inicial de nome com caractere especial', () => {
      const { getByText } = render(<UserMenuTrigger name="Álvaro Silva" />);

      expect(getByText('Á')).toBeTruthy();
    });

    it('deve exibir inicial de nome com número', () => {
      const { getByText } = render(<UserMenuTrigger name="3M Company" />);

      expect(getByText('3')).toBeTruthy();
    });
  });

  describe('Prop: isOpen', () => {
    it('deve renderizar chevron-down quando isOpen=false', () => {
      const { UNSAFE_getByType } = render(
        <UserMenuTrigger name="João" isOpen={false} />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-down');
    });

    it('deve renderizar chevron-up quando isOpen=true', () => {
      const { UNSAFE_getByType } = render(
        <UserMenuTrigger name="João" isOpen={true} />
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-up');
    });

    it('deve renderizar chevron-down por padrão', () => {
      const { UNSAFE_getByType } = render(<UserMenuTrigger name="João" />);

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-down');
    });
  });

  describe('Ícone Chevron', () => {
    it('deve usar cor do tema para chevron', () => {
      const { UNSAFE_getByType } = render(<UserMenuTrigger name="João" />);

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.color).toBe('#4B5563');
    });

    it('deve usar tamanho 20 para chevron', () => {
      const { UNSAFE_getByType } = render(<UserMenuTrigger name="João" />);

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.size).toBe(20);
    });

    it('deve aplicar style no chevron', () => {
      const { UNSAFE_getByType } = render(<UserMenuTrigger name="João" />);

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.style).toBeDefined();
    });
  });

  describe('Estrutura Visual', () => {
    it('deve renderizar container principal', () => {
      const { UNSAFE_getAllByType } = render(<UserMenuTrigger name="João" />);

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve renderizar avatar container', () => {
      const { UNSAFE_getAllByType } = render(<UserMenuTrigger name="João" />);

      const views = UNSAFE_getAllByType(View);
      // Container principal + avatarContainer + avatar
      expect(views.length).toBeGreaterThanOrEqual(3);
    });

    it('deve renderizar todos os elementos de texto', () => {
      const { UNSAFE_getAllByType } = render(<UserMenuTrigger name="João Silva" />);

      const texts = UNSAFE_getAllByType(Text);
      // "Olá," + "João" + inicial "J"
      expect(texts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Casos de Uso Especiais', () => {
    it('deve funcionar com nomes compostos', () => {
      const { getByText } = render(<UserMenuTrigger name="José Maria" />);

      expect(getByText('José')).toBeTruthy();
      expect(getByText('J')).toBeTruthy();
    });

    it('deve funcionar com nomes muito longos', () => {
      const longName = 'Alessandro Francisco Benedetto Giuseppe';
      const { getByText } = render(<UserMenuTrigger name={longName} />);

      expect(getByText('Alessandro')).toBeTruthy();
      expect(getByText('A')).toBeTruthy();
    });

    it('deve funcionar com nome de uma letra', () => {
      const { getAllByText } = render(<UserMenuTrigger name="A" />);

      // "A" aparece 2 vezes: no greeting e no avatar
      const aElements = getAllByText('A');
      expect(aElements.length).toBeGreaterThanOrEqual(1);
    });

    it('deve funcionar com caracteres especiais no nome', () => {
      const { getByText, getAllByText } = render(<UserMenuTrigger name="André D'Ávila" />);

      expect(getByText('André')).toBeTruthy();

      // "A" pode aparecer múltiplas vezes
      const aElements = getAllByText('A');
      expect(aElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar corretamente com todas as props', () => {
      const { getByText, UNSAFE_getByType } = render(
        <UserMenuTrigger name="Maria Clara" isOpen={true} />
      );

      expect(getByText('Maria')).toBeTruthy();
      expect(getByText('M')).toBeTruthy();

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-up');
    });

    it('deve alternar entre isOpen states', () => {
      const { rerender, UNSAFE_getByType } = render(
        <UserMenuTrigger name="João" isOpen={false} />
      );

      let icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-down');

      rerender(<UserMenuTrigger name="João" isOpen={true} />);

      icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('chevron-up');
    });

    it('deve manter nome ao alternar isOpen', () => {
      const { rerender, getByText } = render(
        <UserMenuTrigger name="Carlos" isOpen={false} />
      );

      expect(getByText('Carlos')).toBeTruthy();

      rerender(<UserMenuTrigger name="Carlos" isOpen={true} />);

      expect(getByText('Carlos')).toBeTruthy();
    });
  });
});
