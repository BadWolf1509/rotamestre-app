import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

// Mock do hook useBreakpoint
jest.mock('@/hooks/useBreakpoint', () => ({
  useBreakpoint: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
    isLargeDesktop: false,
  }),
}));

describe('Button Component', () => {
  it('deve renderizar corretamente com texto', () => {
    const { getByText } = render(
      <Button title="Clique aqui" onPress={jest.fn()} />
    );
    expect(getByText('Clique aqui')).toBeTruthy();
  });

  it('deve chamar onPress quando clicado', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Button title="Clique" onPress={mockOnPress} />
    );

    fireEvent.press(getByText('Clique'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('não deve chamar onPress quando desabilitado', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <Button title="Desabilitado" onPress={mockOnPress} disabled />
    );

    fireEvent.press(getByText('Desabilitado'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('deve renderizar com variante primary', () => {
    const { getByText } = render(
      <Button title="Primário" onPress={jest.fn()} variant="primary" />
    );
    expect(getByText('Primário')).toBeTruthy();
  });

  it('deve renderizar com variante secondary', () => {
    const { getByText } = render(
      <Button title="Secundário" onPress={jest.fn()} variant="secondary" />
    );
    expect(getByText('Secundário')).toBeTruthy();
  });

  it('deve mostrar loading quando loading é true', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <Button title="Carregando" onPress={jest.fn()} loading />
    );
    // Quando em loading, o texto não deve aparecer
    expect(queryByText('Carregando')).toBeNull();
    // E deve ter um ActivityIndicator
    const activityIndicator = UNSAFE_getByType('ActivityIndicator' as any);
    expect(activityIndicator).toBeTruthy();
  });

  it('deve renderizar com tamanho large', () => {
    const { getByText } = render(
      <Button title="Grande" onPress={jest.fn()} size="large" />
    );
    expect(getByText('Grande')).toBeTruthy();
  });

  it('deve renderizar com tamanho small', () => {
    const { getByText } = render(
      <Button title="Pequeno" onPress={jest.fn()} size="small" />
    );
    expect(getByText('Pequeno')).toBeTruthy();
  });

  it('deve renderizar com fullWidth', () => {
    const { getByText } = render(
      <Button title="Full Width" onPress={jest.fn()} fullWidth />
    );
    expect(getByText('Full Width')).toBeTruthy();
  });
});
