import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Card } from '../Card';
import { Text } from 'react-native';

describe('Card', () => {
  it('deve renderizar children corretamente', () => {
    const { getByText } = render(
      <Card>
        <Text>Conteúdo do Card</Text>
      </Card>
    );
    expect(getByText('Conteúdo do Card')).toBeTruthy();
  });

  it('deve renderizar como TouchableOpacity quando onPress é fornecido', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Card onPress={onPress}>
        <Text>Tocável</Text>
      </Card>
    );

    fireEvent.press(getByText('Tocável'));
    expect(onPress).toHaveBeenCalled();
  });

  it('deve aplicar estilos de variante', () => {
    // Teste de snapshot ou verificação de estilo (difícil com unistyles mockado, mas verificamos se não quebra)
    const { toJSON } = render(
      <Card variant="outlined">
        <Text>Outlined</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('deve aplicar estilos de padding', () => {
    const { toJSON } = render(
      <Card padding="large">
        <Text>Large Padding</Text>
      </Card>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
