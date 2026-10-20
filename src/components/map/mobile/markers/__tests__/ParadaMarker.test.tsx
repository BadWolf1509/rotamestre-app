import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { ParadaMarker } from '../ParadaMarker';

const baseParada = {
  id: 'p1',
  endereco: 'Rua Teste, 100',
  latitude: -23.55,
  longitude: -46.63,
  status: 'pendente',
  ordem: 1,
  is_checkpoint: false,
};

describe('ParadaMarker', () => {
  const onPress = jest.fn();
  const onLongPress = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders the stop number', () => {
    const { getByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText('1')).toBeTruthy();
  });

  it('does not show callout when not selected', () => {
    const { queryByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(queryByText('Parada 1')).toBeNull();
  });

  it('shows callout with address when selected', () => {
    const { getByText } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={true}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText('Parada 1')).toBeTruthy();
    expect(getByText('Rua Teste, 100')).toBeTruthy();
  });

  it('calls onPress with parada.id when pressed', () => {
    const { getAllByRole } = render(
      <ParadaMarker
        parada={baseParada as any}
        isSelected={false}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    fireEvent.press(getAllByRole('button')[0]);
    expect(onPress).toHaveBeenCalledWith('p1');
  });

  it('shows recipient in callout when selected', () => {
    const parada = { ...baseParada, destinatario: 'João Silva' };
    const { getByText } = render(
      <ParadaMarker
        parada={parada as any}
        isSelected={true}
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    expect(getByText('João Silva')).toBeTruthy();
  });

  describe('pino de um local com vários serviços', () => {
    const servicos = [
      { ordem: 3, tipo: 'entrega', status: 'pendente' },
      { ordem: 4, tipo: 'retirada', status: 'pendente' },
    ];
    const principal = { ...baseParada, ordem: 3, tipo: 'entrega' };

    it('mostra o rótulo do grupo no pino', () => {
      const { getByText } = render(
        <ParadaMarker
          parada={principal as any}
          rotulo="3+4"
          servicos={servicos}
          isSelected={false}
          onPress={onPress}
          onLongPress={onLongPress}
        />,
      );
      expect(getByText('3+4')).toBeTruthy();
    });

    it('lista cada serviço no balão', () => {
      const { getByText } = render(
        <ParadaMarker
          parada={principal as any}
          rotulo="3+4"
          servicos={servicos}
          isSelected={true}
          onPress={onPress}
          onLongPress={onLongPress}
        />,
      );
      expect(getByText('3 · Entrega')).toBeTruthy();
      expect(getByText('4 · Retirada')).toBeTruthy();
    });

    it('descreve as paradas do grupo no accessibilityLabel', () => {
      const { getAllByRole } = render(
        <ParadaMarker
          parada={principal as any}
          rotulo="3+4"
          servicos={servicos}
          isSelected={false}
          onPress={onPress}
          onLongPress={onLongPress}
        />,
      );
      expect(getAllByRole('button')[0].props.accessibilityLabel).toMatch(
        /^Paradas 3 e 4/,
      );
    });

    it('seleciona pelo id da principal', () => {
      const { getAllByRole } = render(
        <ParadaMarker
          parada={principal as any}
          rotulo="3+4"
          servicos={servicos}
          isSelected={false}
          onPress={onPress}
          onLongPress={onLongPress}
        />,
      );
      fireEvent.press(getAllByRole('button')[0]);
      expect(onPress).toHaveBeenCalledWith('p1');
    });
  });
});
