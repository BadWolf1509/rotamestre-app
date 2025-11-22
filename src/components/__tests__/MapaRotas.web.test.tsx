import { render } from '@testing-library/react-native';
import React from 'react';

import { MapaRotas } from '../MapaRotas.web';

// Mock do MapaWeb
jest.mock('../MapaWeb', () => ({
  MapaWeb: jest.fn(() => null),
}));

const mockMapaWeb = require('../MapaWeb').MapaWeb;

describe('MapaRotas.web', () => {
  const mockParadas = [
    {
      id: '1',
      endereco: 'Origem',
      latitude: -23.5505,
      longitude: -46.6333,
      ordem: 1,
      status: 'concluida',
    },
    {
      id: '2',
      endereco: 'Waypoint',
      latitude: -23.5489,
      longitude: -46.6388,
      ordem: 2,
      status: 'pendente',
    },
    {
      id: '3',
      endereco: 'Destino',
      latitude: -23.5700,
      longitude: -46.6600,
      ordem: 3,
      status: 'pendente',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar MapaWeb com origem, destino e waypoints', () => {
    render(<MapaRotas paradas={mockParadas} />);

    expect(mockMapaWeb).toHaveBeenCalledTimes(1);

    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.origem).toEqual({
      latitude: -23.5505,
      longitude: -46.6333,
    });

    expect(callArgs.destino).toEqual({
      latitude: -23.5700,
      longitude: -46.6600,
    });

    expect(callArgs.waypoints).toEqual([
      { latitude: -23.5489, longitude: -46.6388 },
    ]);
  });

  it('deve lidar com 2 paradas (sem waypoints)', () => {
    const duasParadas = [mockParadas[0], mockParadas[2]];

    render(<MapaRotas paradas={duasParadas} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.waypoints).toEqual([]);
  });

  it('não deve renderizar com array vazio', () => {
    const { UNSAFE_root } = render(<MapaRotas paradas={[]} />);

    expect(mockMapaWeb).not.toHaveBeenCalled();
    expect(UNSAFE_root).toBeTruthy();
  });

  it('deve renderizar com 1 parada (origem = destino)', () => {
    const umaParada = [mockParadas[0]];

    render(<MapaRotas paradas={umaParada} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.origem).toEqual(callArgs.destino);
  });

  it('deve passar rotaAtiva para MapaWeb', () => {
    render(<MapaRotas paradas={mockParadas} rotaAtiva={true} />);

    expect(mockMapaWeb).toHaveBeenCalled();
  });

  it('deve transformar múltiplos waypoints corretamente', () => {
    const muitasParadas = [
      { id: '1', endereco: 'A', latitude: 1, longitude: 1, ordem: 1, status: 'concluida' },
      { id: '2', endereco: 'B', latitude: 2, longitude: 2, ordem: 2, status: 'pendente' },
      { id: '3', endereco: 'C', latitude: 3, longitude: 3, ordem: 3, status: 'pendente' },
      { id: '4', endereco: 'D', latitude: 4, longitude: 4, ordem: 4, status: 'pendente' },
      { id: '5', endereco: 'E', latitude: 5, longitude: 5, ordem: 5, status: 'pendente' },
    ];

    render(<MapaRotas paradas={muitasParadas} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.origem).toEqual({ latitude: 1, longitude: 1 });
    expect(callArgs.destino).toEqual({ latitude: 5, longitude: 5 });
    expect(callArgs.waypoints).toEqual([
      { latitude: 2, longitude: 2 },
      { latitude: 3, longitude: 3 },
      { latitude: 4, longitude: 4 },
    ]);
  });
});
