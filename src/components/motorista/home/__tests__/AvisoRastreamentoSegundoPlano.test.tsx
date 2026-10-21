import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { AvisoRastreamentoSegundoPlano } from '../AvisoRastreamentoSegundoPlano';

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

const mockRastreamento = {
  avisoVisivel: true,
  ativar: jest.fn(),
  dispensar: jest.fn(),
};
let mockContexto: { rastreamentoSegundoPlano?: typeof mockRastreamento } = {};
jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => mockContexto,
}));

describe('AvisoRastreamentoSegundoPlano', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContexto = {
      rastreamentoSegundoPlano: { ...mockRastreamento, avisoVisivel: true },
    };
  });

  it('não aparece quando o rastreamento está garantido', () => {
    mockContexto = {
      rastreamentoSegundoPlano: { ...mockRastreamento, avisoVisivel: false },
    };
    const { queryByTestId } = render(<AvisoRastreamentoSegundoPlano />);
    expect(queryByTestId('aviso-rastreamento-segundo-plano')).toBeNull();
  });

  it('não quebra quando o contexto não traz o rastreamento', () => {
    mockContexto = {};
    const { queryByTestId } = render(<AvisoRastreamentoSegundoPlano />);
    expect(queryByTestId('aviso-rastreamento-segundo-plano')).toBeNull();
  });

  it('o botão leva ao fluxo de ativação', () => {
    const { getByText } = render(<AvisoRastreamentoSegundoPlano />);
    fireEvent.press(getByText('Ativar'));
    expect(mockRastreamento.ativar).toHaveBeenCalledTimes(1);
  });

  it('pode ser dispensado', () => {
    const { getByText } = render(<AvisoRastreamentoSegundoPlano />);
    fireEvent.press(getByText('fechar'));
    expect(mockRastreamento.dispensar).toHaveBeenCalledTimes(1);
  });
});
