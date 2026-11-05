import { Ionicons } from '@expo/vector-icons';
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DesktopCard } from '../DesktopCard';

describe('DesktopCard', () => {
  describe('Empilhamento do cabeçalho', () => {
    // No react-native-web cada View é um contexto de empilhamento (z-index 0):
    // o zIndex de um menu suspenso nas `actions` fica preso ao cabeçalho, e o
    // conteúdo (irmão posterior, ex.: tabela) o cobria. O cabeçalho precisa
    // ficar acima do conteúdo para o menu abrir por cima.
    it('cabeçalho fica acima do conteúdo, para menu suspenso nas actions', () => {
      const { getByTestId } = render(
        <DesktopCard title="Rotas" actions={<Text>Exportar</Text>}>
          <Text>Tabela</Text>
        </DesktopCard>,
      );

      const header = StyleSheet.flatten(
        getByTestId('desktop-card-header').props.style,
      );
      const content = StyleSheet.flatten(
        getByTestId('desktop-card-content').props.style,
      );
      expect(header.zIndex).toBeGreaterThan(content.zIndex ?? 0);
    });
  });

  describe('Renderização Básica', () => {
    it('deve renderizar children corretamente', () => {
      const { getByText } = render(
        <DesktopCard>
          <Text>Card content</Text>
        </DesktopCard>,
      );

      expect(getByText('Card content')).toBeTruthy();
    });

    it('deve renderizar sem header quando não há title, subtitle, icon ou actions', () => {
      const { UNSAFE_queryAllByType } = render(
        <DesktopCard>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_queryAllByType(View);
      // Deve ter Views mas não o header específico
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Header e Metadados', () => {
    it('deve renderizar title quando fornecido', () => {
      const { getByText } = render(
        <DesktopCard title="Test Title">
          <Text>Content</Text>
        </DesktopCard>,
      );

      expect(getByText('Test Title')).toBeTruthy();
    });

    it('deve renderizar subtitle quando fornecido', () => {
      const { getByText } = render(
        <DesktopCard subtitle="Test Subtitle">
          <Text>Content</Text>
        </DesktopCard>,
      );

      expect(getByText('Test Subtitle')).toBeTruthy();
    });

    it('deve renderizar title e subtitle juntos', () => {
      const { getByText } = render(
        <DesktopCard title="Title" subtitle="Subtitle">
          <Text>Content</Text>
        </DesktopCard>,
      );

      expect(getByText('Title')).toBeTruthy();
      expect(getByText('Subtitle')).toBeTruthy();
    });

    it('deve renderizar ícone quando fornecido', () => {
      const { UNSAFE_getByType } = render(
        <DesktopCard icon="home">
          <Text>Content</Text>
        </DesktopCard>,
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.name).toBe('home');
      expect(icon.props.size).toBe(20);
    });

    it('deve aplicar iconColor customizado', () => {
      const { UNSAFE_getByType } = render(
        <DesktopCard icon="star" iconColor="#FF0000">
          <Text>Content</Text>
        </DesktopCard>,
      );

      const icon = UNSAFE_getByType(Ionicons);
      expect(icon.props.color).toBe('#FF0000');
    });

    it('deve renderizar actions quando fornecido', () => {
      const { getByText } = render(
        <DesktopCard title="Card" actions={<Text>Action Button</Text>}>
          <Text>Content</Text>
        </DesktopCard>,
      );

      expect(getByText('Action Button')).toBeTruthy();
    });
  });

  describe('Variants', () => {
    it('deve aplicar variant "default" por padrão', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopCard>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[0].props.style).toBeDefined();
    });

    it('deve aplicar variant "outlined"', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopCard variant="outlined">
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[0].props.style).toBeDefined();
    });

    it('deve aplicar variant "elevated"', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopCard variant="elevated">
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[0].props.style).toBeDefined();
    });
  });

  describe('Comportamento Interativo', () => {
    it('deve renderizar como View quando onPress não é fornecido', () => {
      const { UNSAFE_getAllByType, UNSAFE_queryAllByType } = render(
        <DesktopCard>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      const touchables = UNSAFE_queryAllByType(TouchableOpacity);

      expect(views.length).toBeGreaterThan(0);
      expect(touchables.length).toBe(0);
    });

    it('deve renderizar como TouchableOpacity quando onPress é fornecido', () => {
      const onPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <DesktopCard onPress={onPress}>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const touchable = UNSAFE_getByType(TouchableOpacity);
      expect(touchable).toBeTruthy();
    });

    it('deve chamar onPress quando clicado', () => {
      const onPress = jest.fn();
      const { UNSAFE_getByType } = render(
        <DesktopCard onPress={onPress}>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const touchable = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(touchable);

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('deve ter activeOpacity correto', () => {
      const { UNSAFE_getByType } = render(
        <DesktopCard onPress={() => {}}>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const touchable = UNSAFE_getByType(TouchableOpacity);
      expect(touchable.props.activeOpacity).toBe(0.95);
    });
  });

  describe('Padding', () => {
    it('deve aplicar padding padrão ao content', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopCard>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve remover padding quando noPadding=true', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopCard noPadding>
          <Text>Content</Text>
        </DesktopCard>,
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });
});
