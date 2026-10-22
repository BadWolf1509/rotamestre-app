import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { AvisoBateriaRestrita } from '../AvisoBateriaRestrita';

jest.mock('@/components/Alert', () => ({
  Alert: ({
    title,
    actionLabel,
    onAction,
    onClose,
    testID,
  }: {
    title?: string;
    actionLabel?: string;
    onAction?: () => void;
    onClose?: () => void;
    testID?: string;
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        <Pressable onPress={onAction}>
          <Text>{actionLabel}</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>fechar</Text>
        </Pressable>
      </View>
    );
  },
}));

let mockStatusRota: string | undefined;
jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: mockStatusRota ? { status: mockStatusRota } : null,
  }),
}));

const mockAviso = {
  avisoVisivel: true,
  abrirConfiguracoes: jest.fn(),
  dispensar: jest.fn(),
};
const mockUseBateriaRestrita = jest.fn((_: { ativa: boolean }) => mockAviso);
jest.mock('@/hooks/motorista/useBateriaRestrita', () => ({
  useBateriaRestrita: (opcoes: { ativa: boolean }) =>
    mockUseBateriaRestrita(opcoes),
}));

describe('AvisoBateriaRestrita', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatusRota = 'em_andamento';
    mockAviso.avisoVisivel = true;
  });

  it('só confere com a rota em andamento', () => {
    render(<AvisoBateriaRestrita />);
    expect(mockUseBateriaRestrita).toHaveBeenLastCalledWith({ ativa: true });

    mockStatusRota = 'pendente';
    render(<AvisoBateriaRestrita />);
    expect(mockUseBateriaRestrita).toHaveBeenLastCalledWith({ ativa: false });

    mockStatusRota = undefined;
    render(<AvisoBateriaRestrita />);
    expect(mockUseBateriaRestrita).toHaveBeenLastCalledWith({ ativa: false });
  });

  it('não aparece sem restrição', () => {
    mockAviso.avisoVisivel = false;
    const { queryByTestId } = render(<AvisoBateriaRestrita />);
    expect(queryByTestId('aviso-bateria-restrita')).toBeNull();
  });

  it('o botão leva às configurações de bateria do app', () => {
    const { getByText } = render(<AvisoBateriaRestrita />);
    fireEvent.press(getByText('Ajustar bateria'));
    expect(mockAviso.abrirConfiguracoes).toHaveBeenCalledTimes(1);
  });

  it('pode ser dispensado', () => {
    const { getByText } = render(<AvisoBateriaRestrita />);
    fireEvent.press(getByText('fechar'));
    expect(mockAviso.dispensar).toHaveBeenCalledTimes(1);
  });
});
