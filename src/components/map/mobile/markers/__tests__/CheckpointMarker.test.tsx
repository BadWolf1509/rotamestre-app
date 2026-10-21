import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { CheckpointCallout } from '../CheckpointCallout';
import { CheckpointMarker } from '../CheckpointMarker';

describe('CheckpointMarker', () => {
  it('é só o pino: o balão não fica dentro dele', () => {
    const { queryByText, getByLabelText } = render(
      <CheckpointMarker index={0} endereco="Rua A, 100" />,
    );
    expect(getByLabelText('PARTIDA, Rua A, 100')).toBeTruthy();
    expect(queryByText('Copiar endereço')).toBeNull();
  });

  it('rotula CHEGADA para index 1+', () => {
    const { getByLabelText } = render(
      <CheckpointMarker index={1} endereco="Rua B, 200" />,
    );
    expect(getByLabelText('CHEGADA, Rua B, 200')).toBeTruthy();
  });
});

describe('CheckpointCallout', () => {
  const onCopyAddress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('mostra PARTIDA e o endereço (index 0)', () => {
    const { getByText } = render(
      <CheckpointCallout
        index={0}
        endereco="Rua A, 100"
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('PARTIDA')).toBeTruthy();
    expect(getByText('Rua A, 100')).toBeTruthy();
  });

  it('mostra CHEGADA para index 1+', () => {
    const { getByText } = render(
      <CheckpointCallout
        index={1}
        endereco="Rua B, 200"
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('CHEGADA')).toBeTruthy();
  });

  it('mostra o nome da unidade quando informado', () => {
    const { getByText } = render(
      <CheckpointCallout
        index={0}
        endereco="Rua A"
        unidadeNome="WJX Locações"
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('WJX Locações')).toBeTruthy();
  });

  it('"Copiar endereço" entrega o endereço', () => {
    const { getByText } = render(
      <CheckpointCallout
        index={0}
        endereco="Rua A, 100"
        onCopyAddress={onCopyAddress}
      />,
    );
    fireEvent.press(getByText('Copiar endereço'));
    expect(onCopyAddress).toHaveBeenCalledWith('Rua A, 100');
  });
});
