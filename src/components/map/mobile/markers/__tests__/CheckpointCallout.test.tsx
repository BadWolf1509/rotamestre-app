import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { pontosDaUnidade } from '@/components/map/pontosDaUnidade';

import { CheckpointCallout } from '../CheckpointCallout';

const base = { latitude: -7.1, longitude: -34.8, endereco: 'Rua A, 100' };
const [sede] = pontosDaUnidade([
  { ...base, id: 'p0', ordem: 0 },
  { ...base, id: 'c9', ordem: 9 },
]);
const [partida, chegada] = pontosDaUnidade([
  { ...base, id: 'p0', ordem: 0 },
  { ...base, id: 'c9', ordem: 9, latitude: -7.2, endereco: 'Rua B, 200' },
]);

describe('CheckpointCallout', () => {
  const onCopyAddress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  // Partida e chegada no mesmo lugar (100% das rotas em 08/11/2026): um
  // balão só, que diz as duas coisas — sem caixa alta.
  it('sede: "Sede da unidade" e o endereço, sem PARTIDA/CHEGADA', () => {
    const { getByText, queryByText } = render(
      <CheckpointCallout ponto={sede} onCopyAddress={onCopyAddress} />,
    );
    expect(getByText('Sede da unidade')).toBeTruthy();
    expect(getByText('Partida e chegada da rota')).toBeTruthy();
    expect(getByText('Rua A, 100')).toBeTruthy();
    expect(queryByText('PARTIDA')).toBeNull();
    expect(queryByText('CHEGADA')).toBeNull();
  });

  it('separados: "Ponto de partida" e "Ponto de chegada"', () => {
    expect(
      render(
        <CheckpointCallout ponto={partida} onCopyAddress={onCopyAddress} />,
      ).getByText('Ponto de partida'),
    ).toBeTruthy();
    const deChegada = render(
      <CheckpointCallout ponto={chegada} onCopyAddress={onCopyAddress} />,
    );
    expect(deChegada.getByText('Ponto de chegada')).toBeTruthy();
    expect(deChegada.getByText('Rua B, 200')).toBeTruthy();
  });

  it('mostra o nome da unidade quando informado', () => {
    const { getByText } = render(
      <CheckpointCallout
        ponto={sede}
        unidadeNome="WJX Locações"
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('WJX Locações')).toBeTruthy();
  });

  it('"Copiar endereço" entrega o endereço', () => {
    const { getByText } = render(
      <CheckpointCallout ponto={sede} onCopyAddress={onCopyAddress} />,
    );
    fireEvent.press(getByText('Copiar endereço'));
    expect(onCopyAddress).toHaveBeenCalledWith('Rua A, 100');
  });
});
