import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  it('deve renderizar corretamente com texto', () => {
    const { getByText } = render(<Button>Clique aqui</Button>);
    expect(getByText('Clique aqui')).toBeTruthy();
  });

  it('deve chamar onPress quando clicado', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Button onPress={mockOnPress}>Clique</Button>
    );

    fireEvent.press(getByText('Clique'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('não deve chamar onPress quando desabilitado', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Button onPress={mockOnPress} disabled>
        Desabilitado
      </Button>
    );

    fireEvent.press(getByText('Desabilitado'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('deve aplicar variante primary corretamente', () => {
    const { getByText } = render(
      <Button variant="primary">Primário</Button>
    );
    const button = getByText('Primário').parent;
    expect(button).toHaveStyle({ backgroundColor: '#1e5aa8' });
  });

  it('deve aplicar variante secondary corretamente', () => {
    const { getByText } = render(
      <Button variant="secondary">Secundário</Button>
    );
    const button = getByText('Secundário').parent;
    expect(button).toHaveStyle({ backgroundColor: '#f7a02a' });
  });

  it('deve mostrar loading quando isLoading é true', () => {
    const { getByTestId } = render(
      <Button isLoading>Carregando</Button>
    );
    expect(getByTestId('button-loading')).toBeTruthy();
  });

  it('deve aplicar tamanho large corretamente', () => {
    const { getByText } = render(
      <Button size="large">Grande</Button>
    );
    const button = getByText('Grande').parent;
    expect(button).toHaveStyle({ paddingVertical: 16 });
  });

  it('deve aplicar tamanho small corretamente', () => {
    const { getByText } = render(
      <Button size="small">Pequeno</Button>
    );
    const button = getByText('Pequeno').parent;
    expect(button).toHaveStyle({ paddingVertical: 8 });
  });

  it('deve aceitar styles customizados', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Button style={customStyle}>Custom</Button>
    );
    const button = getByText('Custom').parent;
    expect(button).toHaveStyle(customStyle);
  });
});
