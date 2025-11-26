import { render } from '@testing-library/react-native';
import React from 'react';

// Mock do MapaWeb (default export) - precisa ser definido antes do import
jest.mock('../MapaWeb', () => {
  const mockFn = jest.fn(() => null);
  return {
    __esModule: true,
    default: mockFn,
  };
});

import { MapaRotas } from '../MapaRotas.web';
import MapaWeb from '../MapaWeb';

const mockMapaWeb = MapaWeb as jest.Mock;

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

  it('deve renderizar MapaWeb com paradas', () => {
    render(<MapaRotas paradas={mockParadas} />);

    expect(mockMapaWeb).toHaveBeenCalledTimes(1);

    const callArgs = mockMapaWeb.mock.calls[0][0];

    // MapaRotas.web agora passa apenas paradas para MapaWeb
    expect(callArgs.paradas).toEqual(mockParadas);
  });

  it('deve lidar com 2 paradas', () => {
    const duasParadas = [mockParadas[0], mockParadas[2]];

    render(<MapaRotas paradas={duasParadas} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.paradas).toEqual(duasParadas);
  });

  it('deve renderizar com array vazio', () => {
    render(<MapaRotas paradas={[]} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];
    expect(callArgs.paradas).toEqual([]);
  });

  it('deve renderizar com 1 parada', () => {
    const umaParada = [mockParadas[0]];

    render(<MapaRotas paradas={umaParada} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];

    expect(callArgs.paradas).toEqual(umaParada);
  });

  it('deve passar paradas para MapaWeb', () => {
    render(<MapaRotas paradas={mockParadas} rotaAtiva={true} />);

    expect(mockMapaWeb).toHaveBeenCalled();
    const callArgs = mockMapaWeb.mock.calls[0][0];
    expect(callArgs.paradas).toEqual(mockParadas);
  });

  it('deve passar múltiplas paradas corretamente', () => {
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

    expect(callArgs.paradas).toEqual(muitasParadas);
    expect(callArgs.paradas).toHaveLength(5);
  });
});
