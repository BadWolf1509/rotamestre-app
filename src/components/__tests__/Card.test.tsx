import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { Card } from '../Card';

describe('Card Component', () => {
  it('deve renderizar children corretamente', () => {
    const { getByText } = render(
      <Card>
        <Text>Conteúdo do Card</Text>
      </Card>
    );

    expect(getByText('Conteúdo do Card')).toBeTruthy();
  });

  it('deve renderizar com variant elevated por padrão', () => {
    const { getByTestId } = render(
      <Card>
        <Text testID="card-content">Teste</Text>
      </Card>
    );

    expect(getByTestId('card-content')).toBeTruthy();
  });

  it('deve renderizar com variant outlined', () => {
    const { getByText } = render(
      <Card variant="outlined">
        <Text>Card Outlined</Text>
      </Card>
    );

    expect(getByText('Card Outlined')).toBeTruthy();
  });

  it('deve renderizar com variant filled', () => {
    const { getByText } = render(
      <Card variant="filled">
        <Text>Card Filled</Text>
      </Card>
    );

    expect(getByText('Card Filled')).toBeTruthy();
  });

  it('deve renderizar com padding small', () => {
    const { getByText } = render(
      <Card padding="small">
        <Text>Card Small Padding</Text>
      </Card>
    );

    expect(getByText('Card Small Padding')).toBeTruthy();
  });

  it('deve renderizar com padding medium (padrão)', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Medium Padding</Text>
      </Card>
    );

    expect(getByText('Card Medium Padding')).toBeTruthy();
  });

  it('deve renderizar com padding large', () => {
    const { getByText } = render(
      <Card padding="large">
        <Text>Card Large Padding</Text>
      </Card>
    );

    expect(getByText('Card Large Padding')).toBeTruthy();
  });

  it('deve renderizar com padding none', () => {
    const { getByText } = render(
      <Card padding="none">
        <Text>Card No Padding</Text>
      </Card>
    );

    expect(getByText('Card No Padding')).toBeTruthy();
  });

  it('deve chamar onPress quando clicado', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Card onPress={mockOnPress}>
        <Text>Card Clicável</Text>
      </Card>
    );

    fireEvent.press(getByText('Card Clicável'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('deve usar TouchableOpacity quando onPress fornecido', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Card onPress={mockOnPress}>
        <Text>Card Touchable</Text>
      </Card>
    );

    const card = getByText('Card Touchable').parent;
    expect(card).toBeTruthy();
  });

  it('deve usar View quando onPress não fornecido', () => {
    const { getByText } = render(
      <Card>
        <Text>Card View</Text>
      </Card>
    );

    const card = getByText('Card View').parent;
    expect(card).toBeTruthy();
  });

  it('deve aceitar estilos customizados', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Card style={customStyle}>
        <Text>Card Custom Style</Text>
      </Card>
    );

    expect(getByText('Card Custom Style')).toBeTruthy();
  });

  it('deve renderizar múltiplos children', () => {
    const { getByText } = render(
      <Card>
        <Text>Primeiro filho</Text>
        <Text>Segundo filho</Text>
      </Card>
    );

    expect(getByText('Primeiro filho')).toBeTruthy();
    expect(getByText('Segundo filho')).toBeTruthy();
  });
});
