import { render } from '@testing-library/react-native';
import React from 'react';

import { CheckpointMarker } from '../CheckpointMarker';

describe('CheckpointMarker', () => {
  const onCopyAddress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('does not show callout when not selected', () => {
    const { queryByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A, 100"
        isSelected={false}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(queryByText('PARTIDA')).toBeNull();
  });

  it('shows callout with PARTIDA label and address when selected (index 0)', () => {
    const { getByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A, 100"
        isSelected={true}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('PARTIDA')).toBeTruthy();
    expect(getByText('Rua A, 100')).toBeTruthy();
  });

  it('shows callout with CHEGADA label for index 1+', () => {
    const { getByText } = render(
      <CheckpointMarker
        index={1}
        endereco="Rua B, 200"
        isSelected={true}
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('CHEGADA')).toBeTruthy();
  });

  it('shows unidade name in callout when selected and unidadeNome provided', () => {
    const { getByText } = render(
      <CheckpointMarker
        index={0}
        endereco="Rua A"
        isSelected={true}
        unidadeNome="WJX Locações"
        onCopyAddress={onCopyAddress}
      />,
    );
    expect(getByText('WJX Locações')).toBeTruthy();
  });
});
