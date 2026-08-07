import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { supabase } from '@/lib/supabase';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isDesktop: false, isMobile: true, isTablet: false }),
}));

jest.mock('@/components/ResponsiveContainer', () => ({
  ResponsiveContainer: ({ children }: any) => children,
}));

// Stub de AddressAutocomplete: expõe um campo de texto (para o onChangeText
// normal) e um botão que simula "selecionar uma sugestão da lista", disparando
// onSelectAddress com o 3º argumento (coordenadas) — sem depender do fluxo
// real de busca/debounce/rede do componente de verdade.
jest.mock('@/components/AddressAutocomplete', () => {
  const ReactActual = require('react');
  const { View, TextInput, TouchableOpacity, Text } = require('react-native');
  return {
    AddressAutocomplete: ({
      value,
      onChangeText,
      onSelectAddress,
      placeholder,
      error,
    }: any) =>
      ReactActual.createElement(
        View,
        null,
        ReactActual.createElement(TextInput, {
          testID: 'mock-endereco-input',
          placeholder,
          value,
          onChangeText,
        }),
        error ? ReactActual.createElement(Text, null, error) : null,
        ReactActual.createElement(
          TouchableOpacity,
          {
            testID: 'mock-endereco-selecionar',
            onPress: () =>
              onSelectAddress(
                'Av. Epitácio Pessoa, 100 - João Pessoa/PB',
                'osm_W123456',
                { latitude: -7.1195, longitude: -34.845 },
              ),
          },
          ReactActual.createElement(Text, null, 'Selecionar sugestão'),
        ),
      ),
  };
});

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const CriarUnidade = require('../criar-unidade').default;

describe('tela de onboarding: criar unidade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest
      .fn()
      .mockResolvedValue({ data: 'unidade-1', error: null });
  });

  it('preenche o formulário, seleciona um endereço com coordenadas e envia p_sede_latitude/p_sede_longitude preenchidos para a RPC', async () => {
    const { getByLabelText, getByText, getByTestId } = render(<CriarUnidade />);

    fireEvent.changeText(getByLabelText('Seu nome'), 'Maria Souza');
    fireEvent.changeText(
      getByLabelText('Nome da empresa'),
      'Transportes Souza',
    );
    fireEvent.changeText(getByLabelText('Cidade'), 'João Pessoa');

    // Simula a seleção de uma sugestão da lista (só assim o AddressAutocomplete
    // real entregaria coordenadas — digitar sozinho nunca preenche lat/long).
    fireEvent.press(getByTestId('mock-endereco-selecionar'));

    fireEvent.press(getByText('Criar unidade'));

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'criar_unidade_para_novo_gestor',
        expect.objectContaining({
          p_gestor_nome: 'Maria Souza',
          p_unidade_nome: 'Transportes Souza',
          p_cidade: 'João Pessoa',
          p_sede_latitude: -7.1195,
          p_sede_longitude: -34.845,
        }),
      );
    });

    // Regressão: se alguém remover os setValue('latitude'/'longitude') do
    // onSelectAddress, ou o 3º argumento (coordenadas) do AddressAutocomplete,
    // o payload volta a mandar undefined e a unidade nasce sem sede.
    const payload = (mockSupabase.rpc as jest.Mock).mock.calls[0][1];
    expect(payload.p_sede_latitude).not.toBeUndefined();
    expect(payload.p_sede_longitude).not.toBeUndefined();
  });

  it('não chama a RPC se o endereço foi digitado mas nenhuma sugestão foi selecionada', async () => {
    const { getByLabelText, getByText, getByTestId } = render(<CriarUnidade />);

    fireEvent.changeText(getByLabelText('Seu nome'), 'Maria Souza');
    fireEvent.changeText(
      getByLabelText('Nome da empresa'),
      'Transportes Souza',
    );
    fireEvent.changeText(getByLabelText('Cidade'), 'João Pessoa');
    // Digita no campo de endereço sem tocar no botão de seleção — sem
    // coordenadas, o `.refine` do schema deve barrar o submit.
    fireEvent.changeText(
      getByTestId('mock-endereco-input'),
      'Av. Epitácio Pessoa, 100',
    );

    fireEvent.press(getByText('Criar unidade'));

    await waitFor(() => {
      expect(
        getByText('Selecione o endereço na lista de sugestões'),
      ).toBeTruthy();
    });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
