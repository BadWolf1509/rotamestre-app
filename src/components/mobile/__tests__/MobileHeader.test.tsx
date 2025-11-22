import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { MobileHeader } from '../MobileHeader';

// Mock StyleSheet
jest.mock('@/utils/styles', () => ({
  StyleSheet: {
    create: (fn: Function) =>
      fn({
        spacing: { md: 12, '2xl': 24, '3xl': 32 },
        typography: { sm: 14, '3xl': 30, fontDisplay: 'Poppins-Bold' },
        colors: {
          white: '#FFFFFF',
          gray200: '#E5E7EB',
          gray500: '#6B7280',
          gray900: '#111827',
        },
      }),
  },
}));

describe('MobileHeader Component', () => {
  describe('Renderização Básica', () => {
    it('deve renderizar apenas com title', () => {
      const { getByText } = render(<MobileHeader title="Dashboard" />);

      expect(getByText('Dashboard')).toBeTruthy();
    });

    it('deve renderizar title com estilo correto', () => {
      const { getByText } = render(<MobileHeader title="Rotas" />);

      const titleElement = getByText('Rotas');
      expect(titleElement).toBeTruthy();
      expect(titleElement.props.style).toBeDefined();
    });

    it('deve renderizar title longo', () => {
      const longTitle = 'Gerenciamento de Rotas e Entregas';
      const { getByText } = render(<MobileHeader title={longTitle} />);

      expect(getByText(longTitle)).toBeTruthy();
    });

    it('deve renderizar title com caracteres especiais', () => {
      const { getByText } = render(<MobileHeader title="Configurações & Ajustes" />);

      expect(getByText('Configurações & Ajustes')).toBeTruthy();
    });
  });

  describe('Prop: subtitle', () => {
    it('deve renderizar subtitle quando fornecido', () => {
      const { getByText } = render(
        <MobileHeader title="Dashboard" subtitle="Visão geral" />
      );

      expect(getByText('Dashboard')).toBeTruthy();
      expect(getByText('Visão geral')).toBeTruthy();
    });

    it('não deve renderizar subtitle quando não fornecido', () => {
      const { UNSAFE_getAllByType } = render(
        <MobileHeader title="Dashboard" />
      );

      const texts = UNSAFE_getAllByType(Text);
      // Apenas 1 Text (title)
      expect(texts.length).toBe(1);
    });

    it('deve renderizar subtitle com estilo correto', () => {
      const { getByText } = render(
        <MobileHeader title="Dashboard" subtitle="Resumo do dia" />
      );

      const subtitle = getByText('Resumo do dia');
      expect(subtitle.props.style).toBeDefined();
    });

    it('deve renderizar subtitle vazio', () => {
      const { queryByText } = render(
        <MobileHeader title="Dashboard" subtitle="" />
      );

      // subtitle vazio não deve renderizar
      const texts = queryByText('');
      expect(texts).toBeNull();
    });

    it('deve renderizar subtitle longo', () => {
      const longSubtitle = 'Esta é uma descrição muito longa do conteúdo da página';
      const { getByText } = render(
        <MobileHeader title="Dashboard" subtitle={longSubtitle} />
      );

      expect(getByText(longSubtitle)).toBeTruthy();
    });
  });

  describe('Prop: rightContent', () => {
    it('deve renderizar rightContent quando fornecido', () => {
      const RightButton = () => <Text>Botão</Text>;

      const { getByText } = render(
        <MobileHeader title="Dashboard" rightContent={<RightButton />} />
      );

      expect(getByText('Dashboard')).toBeTruthy();
      expect(getByText('Botão')).toBeTruthy();
    });

    it('não deve renderizar container de rightContent quando não fornecido', () => {
      const { UNSAFE_getAllByType } = render(<MobileHeader title="Dashboard" />);

      const views = UNSAFE_getAllByType(View);
      // header + headerContent + textContainer (sem rightContent)
      expect(views.length).toBe(3);
    });

    it('deve renderizar rightContent complexo', () => {
      const ComplexContent = () => (
        <View>
          <Text>Ação 1</Text>
          <Text>Ação 2</Text>
        </View>
      );

      const { getByText } = render(
        <MobileHeader title="Dashboard" rightContent={<ComplexContent />} />
      );

      expect(getByText('Ação 1')).toBeTruthy();
      expect(getByText('Ação 2')).toBeTruthy();
    });

    it('deve renderizar rightContent com ícone', () => {
      const IconContent = () => <Text>🔔</Text>;

      const { getByText } = render(
        <MobileHeader title="Dashboard" rightContent={<IconContent />} />
      );

      expect(getByText('🔔')).toBeTruthy();
    });

    it('deve aplicar estilo no container de rightContent', () => {
      const RightButton = () => <Text>Botão</Text>;

      const { UNSAFE_getAllByType } = render(
        <MobileHeader title="Dashboard" rightContent={<RightButton />} />
      );

      const views = UNSAFE_getAllByType(View);
      // header + headerContent + textContainer + rightContent
      expect(views.length).toBe(4);
    });
  });

  describe('Combinações de Props', () => {
    it('deve renderizar title + subtitle', () => {
      const { getByText } = render(
        <MobileHeader title="Rotas" subtitle="Gerencie suas rotas" />
      );

      expect(getByText('Rotas')).toBeTruthy();
      expect(getByText('Gerencie suas rotas')).toBeTruthy();
    });

    it('deve renderizar title + rightContent', () => {
      const RightButton = () => <Text>Adicionar</Text>;

      const { getByText } = render(
        <MobileHeader title="Rotas" rightContent={<RightButton />} />
      );

      expect(getByText('Rotas')).toBeTruthy();
      expect(getByText('Adicionar')).toBeTruthy();
    });

    it('deve renderizar todas as props juntas', () => {
      const RightButton = () => <Text>➕</Text>;

      const { getByText } = render(
        <MobileHeader
          title="Rotas"
          subtitle="Total: 15 rotas"
          rightContent={<RightButton />}
        />
      );

      expect(getByText('Rotas')).toBeTruthy();
      expect(getByText('Total: 15 rotas')).toBeTruthy();
      expect(getByText('➕')).toBeTruthy();
    });
  });

  describe('Estrutura Visual', () => {
    it('deve renderizar container principal', () => {
      const { UNSAFE_getAllByType } = render(<MobileHeader title="Dashboard" />);

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve renderizar headerContent', () => {
      const { UNSAFE_getAllByType } = render(<MobileHeader title="Dashboard" />);

      const views = UNSAFE_getAllByType(View);
      // header + headerContent + textContainer
      expect(views.length).toBe(3);
    });

    it('deve renderizar textContainer', () => {
      const { UNSAFE_getAllByType } = render(
        <MobileHeader title="Dashboard" subtitle="Bem-vindo" />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThanOrEqual(3);
    });

    it('deve ter hierarquia correta de Views', () => {
      const { UNSAFE_getAllByType } = render(
        <MobileHeader
          title="Dashboard"
          subtitle="Resumo"
          rightContent={<Text>X</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      // header + headerContent + textContainer + rightContent
      expect(views.length).toBe(4);
    });
  });

  describe('Casos de Uso Reais', () => {
    it('deve funcionar como header de dashboard', () => {
      const { getByText } = render(
        <MobileHeader title="Dashboard" subtitle="Bem-vindo de volta!" />
      );

      expect(getByText('Dashboard')).toBeTruthy();
      expect(getByText('Bem-vindo de volta!')).toBeTruthy();
    });

    it('deve funcionar como header de lista com ação', () => {
      const AddButton = () => <Text>+ Nova Rota</Text>;

      const { getByText } = render(
        <MobileHeader
          title="Minhas Rotas"
          subtitle="5 rotas ativas"
          rightContent={<AddButton />}
        />
      );

      expect(getByText('Minhas Rotas')).toBeTruthy();
      expect(getByText('5 rotas ativas')).toBeTruthy();
      expect(getByText('+ Nova Rota')).toBeTruthy();
    });

    it('deve funcionar como header de configurações', () => {
      const { getByText } = render(<MobileHeader title="Configurações" />);

      expect(getByText('Configurações')).toBeTruthy();
    });

    it('deve funcionar como header de perfil com ícone', () => {
      const EditIcon = () => <Text>✏️</Text>;

      const { getByText } = render(
        <MobileHeader
          title="Meu Perfil"
          subtitle="João Silva"
          rightContent={<EditIcon />}
        />
      );

      expect(getByText('Meu Perfil')).toBeTruthy();
      expect(getByText('João Silva')).toBeTruthy();
      expect(getByText('✏️')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('deve renderizar com title vazio', () => {
      const { getByText } = render(<MobileHeader title="" />);

      expect(getByText('')).toBeTruthy();
    });

    it('deve renderizar com título numérico', () => {
      const { getByText } = render(<MobileHeader title="123" />);

      expect(getByText('123')).toBeTruthy();
    });

    it('deve renderizar com rightContent null explicitamente', () => {
      const { UNSAFE_getAllByType } = render(
        <MobileHeader title="Dashboard" rightContent={null} />
      );

      const views = UNSAFE_getAllByType(View);
      // Sem rightContent container
      expect(views.length).toBe(3);
    });

    it('deve renderizar subtitle com quebras de linha', () => {
      const multilineSubtitle = 'Linha 1\nLinha 2';
      const { UNSAFE_getAllByType } = render(
        <MobileHeader title="Dashboard" subtitle={multilineSubtitle} />
      );

      const texts = UNSAFE_getAllByType(Text);
      // Deve ter 2 textos: title + subtitle (com quebra de linha)
      expect(texts.length).toBe(2);
      expect(texts[1].props.children).toBe(multilineSubtitle);
    });
  });
});
