import { zodResolver } from '@hookform/resolvers/zod';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { useForm } from 'react-hook-form';

import { paradaSchema } from '@/hooks/useNovaEntrega';

import { FormularioParada } from '../FormularioParada';

import type { ParadaFormDataWithCoords } from '../types';

// Stub do autocomplete: um TextInput comum mais um gatilho que reproduz o
// contrato real de seleção — (endereço, place_id, coordenadas), ver
// src/components/AddressAutocomplete.tsx:290. O componente real tem debounce
// de 1s e chamada de rede, que não têm o que fazer aqui.
jest.mock('@/components/AddressAutocomplete', () => {
  const ReactActual = require('react');
  const { View, TextInput, Text } = require('react-native');
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
          testID: 'mock-endereco',
          placeholder,
          value,
          onChangeText,
        }),
        error ? ReactActual.createElement(Text, null, error) : null,
        ReactActual.createElement(
          Text,
          {
            testID: 'mock-selecionar',
            onPress: () =>
              onSelectAddress(
                'Avenida Cabo Branco, 500 - Cabo Branco, João Pessoa - PB',
                'place-cabo-branco',
                { latitude: -7.1487, longitude: -34.7952 },
              ),
          },
          'selecionar',
        ),
      ),
  };
});

const ERRO_COORDENADAS = 'Selecione um endereço nas sugestões para validá-lo.';

// Monta um formulário real com o schema da tela e liga o FormularioParada nele,
// espelhando o objeto `formProps` de app/gestor/nova-entrega.tsx.
function Harness() {
  const {
    control,
    formState: { errors },
    setValue,
    clearErrors,
    handleSubmit,
    watch,
  } = useForm<ParadaFormDataWithCoords>({
    resolver: zodResolver(paradaSchema),
    defaultValues: {
      tipo: 'entrega',
      endereco: '',
      destinatario: '',
      telefone: '',
      observacoes: '',
      latitude: undefined,
      longitude: undefined,
    },
  });

  const latitude = watch('latitude');
  const longitude = watch('longitude');

  return (
    <FormularioParada
      control={control}
      errors={errors}
      setValue={setValue}
      clearErrors={clearErrors}
      handleSubmit={handleSubmit}
      watch={watch}
      onAddParada={jest.fn()}
      isLoading={false}
      retiradasDisponiveis={[]}
      vinculoSelecionado=""
      setVinculoSelecionado={jest.fn()}
      hasValidCoordinates={latitude != null && longitude != null}
    />
  );
}

async function preencherEDispararErro() {
  fireEvent.changeText(
    screen.getByTestId('mock-endereco'),
    'Avenida Cabo Branco, 500',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('Nome do destinatário'),
    'Loja Teste',
  );
  fireEvent.changeText(
    screen.getByPlaceholderText('(00) 00000-0000'),
    '83999555555',
  );
  fireEvent.press(screen.getByText('+ Adicionar Parada'));
  await waitFor(() => expect(screen.getByText(ERRO_COORDENADAS)).toBeTruthy());
}

describe('FormularioParada — erro de endereço', () => {
  it('exige a seleção de uma sugestão quando o endereço é só digitado', async () => {
    render(<Harness />);
    await preencherEDispararErro();

    expect(screen.getByText(ERRO_COORDENADAS)).toBeTruthy();
    // Sem coordenadas o badge não pode aparecer — é o par honesto do erro.
    expect(screen.queryByText('Validado')).toBeNull();
  });

  it('limpa o erro assim que a sugestão é selecionada', async () => {
    render(<Harness />);
    await preencherEDispararErro();

    fireEvent.press(screen.getByTestId('mock-selecionar'));

    // Regressão: o erro nasce do superRefine em `endereco`, mas quem o causa é
    // a ausência de lat/long — que `setValue` não revalida. O erro ficava preso
    // na tela junto do badge verde "Validado", dois sinais contraditórios no
    // mesmo campo, mandando o gestor refazer o que acabara de fazer.
    await waitFor(() =>
      expect(screen.queryByText(ERRO_COORDENADAS)).toBeNull(),
    );
  });

  it('mostra o badge Validado depois da seleção', async () => {
    render(<Harness />);
    await preencherEDispararErro();

    fireEvent.press(screen.getByTestId('mock-selecionar'));

    await waitFor(() => expect(screen.getByText('Validado')).toBeTruthy());
  });
});
