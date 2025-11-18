import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import { MapaRotas } from '../MapaRotas';

// Mock dos componentes de mapa
jest.mock('../MapaRN', () => ({
  MapaRN: jest.fn(() => null),
}));

jest.mock('../MapaWeb', () => ({
  MapaWeb: jest.fn(() => null),
}));

const mockMapaRN = require('../MapaRN').MapaRN;
const mockMapaWeb = require('../MapaWeb').MapaWeb;

describe('MapaRotas', () => {
  const mockParadas = [
    {
      id: '1',
      endereco: 'Origem - Rua A, 123',
      latitude: -23.5505,
      longitude: -46.6333,
      ordem: 1,
      status: 'concluida',
    },
    {
      id: '2',
      endereco: 'Waypoint 1 - Rua B, 456',
      latitude: -23.5489,
      longitude: -46.6388,
      ordem: 2,
      status: 'pendente',
    },
    {
      id: '3',
      endereco: 'Waypoint 2 - Rua C, 789',
      latitude: -23.5600,
      longitude: -46.6500,
      ordem: 3,
      status: 'pendente',
    },
    {
      id: '4',
      endereco: 'Destino - Rua D, 999',
      latitude: -23.5700,
      longitude: -46.6600,
      ordem: 4,
      status: 'pendente',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Plataforma Web', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'web'),
        configurable: true,
      });
    });

    it('deve renderizar MapaWeb quando Platform.OS é "web"', () => {
      render(<MapaRotas paradas={mockParadas} />);

      expect(mockMapaWeb).toHaveBeenCalledTimes(1);
      expect(mockMapaRN).not.toHaveBeenCalled();
    });

    it('deve transformar paradas em origem, destino e waypoints', () => {
      render(<MapaRotas paradas={mockParadas} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      // Origem = primeira parada
      expect(callArgs.origem).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });

      // Destino = última parada
      expect(callArgs.destino).toEqual({
        latitude: -23.5700,
        longitude: -46.6600,
      });

      // Waypoints = paradas intermediárias (2 e 3)
      expect(callArgs.waypoints).toEqual([
        { latitude: -23.5489, longitude: -46.6388 },
        { latitude: -23.5600, longitude: -46.6500 },
      ]);
    });

    it('deve passar rotaAtiva para MapaWeb', () => {
      render(<MapaRotas paradas={mockParadas} rotaAtiva={true} />);

      expect(mockMapaWeb).toHaveBeenCalled();
    });

    it('deve lidar com 2 paradas (sem waypoints)', () => {
      const duasParadas = [mockParadas[0], mockParadas[3]];

      render(<MapaRotas paradas={duasParadas} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      expect(callArgs.origem).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
      });

      expect(callArgs.destino).toEqual({
        latitude: -23.5700,
        longitude: -46.6600,
      });

      // Sem waypoints
      expect(callArgs.waypoints).toEqual([]);
    });

    it('não deve renderizar se não há origem (array vazio)', () => {
      const { UNSAFE_root } = render(<MapaRotas paradas={[]} />);

      expect(mockMapaWeb).not.toHaveBeenCalled();
      expect(UNSAFE_root).toBeTruthy();
    });

    it('deve renderizar mesmo com 1 parada (origem = destino)', () => {
      const umaParada = [mockParadas[0]];

      render(<MapaRotas paradas={umaParada} />);

      // Quando há apenas 1 parada, origem e destino são iguais
      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      expect(callArgs.origem).toEqual(callArgs.destino);
      expect(callArgs.waypoints).toEqual([]);
    });

    it('deve lidar com 3 paradas (1 waypoint)', () => {
      const tresParadas = [mockParadas[0], mockParadas[1], mockParadas[2]];

      render(<MapaRotas paradas={tresParadas} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      expect(callArgs.waypoints).toEqual([
        { latitude: -23.5489, longitude: -46.6388 },
      ]);
    });

    it('deve lidar com muitas paradas (muitos waypoints)', () => {
      const muitasParadas = Array.from({ length: 20 }, (_, i) => ({
        id: `parada-${i}`,
        endereco: `Rua ${i}`,
        latitude: -23.5505 + i * 0.01,
        longitude: -46.6333 + i * 0.01,
        ordem: i + 1,
        status: 'pendente',
      }));

      render(<MapaRotas paradas={muitasParadas} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      // Deve ter 18 waypoints (20 paradas - origem - destino)
      expect(callArgs.waypoints.length).toBe(18);
    });
  });

  describe('Plataforma iOS', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'ios'),
        configurable: true,
      });
    });

    it('deve renderizar MapaRN quando Platform.OS é "ios"', () => {
      render(<MapaRotas paradas={mockParadas} />);

      expect(mockMapaRN).toHaveBeenCalledTimes(1);
      expect(mockMapaWeb).not.toHaveBeenCalled();
    });

    it('deve passar todas as props para MapaRN', () => {
      render(<MapaRotas paradas={mockParadas} rotaAtiva={true} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];

      expect(callArgs.paradas).toEqual(mockParadas);
      expect(callArgs.rotaAtiva).toBe(true);
    });

    it('deve renderizar MapaRN mesmo com array vazio', () => {
      render(<MapaRotas paradas={[]} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];
      expect(callArgs.paradas).toEqual([]);
    });
  });

  describe('Plataforma Android', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'android'),
        configurable: true,
      });
    });

    it('deve renderizar MapaRN quando Platform.OS é "android"', () => {
      render(<MapaRotas paradas={mockParadas} />);

      expect(mockMapaRN).toHaveBeenCalledTimes(1);
      expect(mockMapaWeb).not.toHaveBeenCalled();
    });

    it('deve passar todas as props para MapaRN', () => {
      render(<MapaRotas paradas={mockParadas} rotaAtiva={false} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];

      expect(callArgs.paradas).toEqual(mockParadas);
      expect(callArgs.rotaAtiva).toBe(false);
    });
  });

  describe('Prop rotaAtiva', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'ios'),
        configurable: true,
      });
    });

    it('deve funcionar com rotaAtiva=true', () => {
      render(<MapaRotas paradas={mockParadas} rotaAtiva={true} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];
      expect(callArgs.rotaAtiva).toBe(true);
    });

    it('deve funcionar com rotaAtiva=false', () => {
      render(<MapaRotas paradas={mockParadas} rotaAtiva={false} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];
      expect(callArgs.rotaAtiva).toBe(false);
    });

    it('deve funcionar sem rotaAtiva (undefined)', () => {
      render(<MapaRotas paradas={mockParadas} />);

      expect(mockMapaRN).toHaveBeenCalled();
      const callArgs = mockMapaRN.mock.calls[0][0];
      expect(callArgs.rotaAtiva).toBeUndefined();
    });
  });

  describe('Transformação de Dados (Web)', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'web'),
        configurable: true,
      });
    });

    it('deve extrair latitude e longitude corretamente', () => {
      const paradasCustom = [
        {
          id: '1',
          endereco: 'A',
          latitude: -10.5,
          longitude: -50.3,
          ordem: 1,
          status: 'concluida',
        },
        {
          id: '2',
          endereco: 'B',
          latitude: -20.7,
          longitude: -60.9,
          ordem: 2,
          status: 'pendente',
        },
      ];

      render(<MapaRotas paradas={paradasCustom} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      expect(callArgs.origem.latitude).toBe(-10.5);
      expect(callArgs.origem.longitude).toBe(-50.3);
      expect(callArgs.destino.latitude).toBe(-20.7);
      expect(callArgs.destino.longitude).toBe(-60.9);
    });

    it('deve preservar ordem dos waypoints', () => {
      const paradasOrdenadas = [
        { id: '1', endereco: 'A', latitude: 1, longitude: 1, ordem: 1, status: 'concluida' },
        { id: '2', endereco: 'B', latitude: 2, longitude: 2, ordem: 2, status: 'pendente' },
        { id: '3', endereco: 'C', latitude: 3, longitude: 3, ordem: 3, status: 'pendente' },
        { id: '4', endereco: 'D', latitude: 4, longitude: 4, ordem: 4, status: 'pendente' },
        { id: '5', endereco: 'E', latitude: 5, longitude: 5, ordem: 5, status: 'pendente' },
      ];

      render(<MapaRotas paradas={paradasOrdenadas} />);

      expect(mockMapaWeb).toHaveBeenCalled();
      const callArgs = mockMapaWeb.mock.calls[0][0];

      expect(callArgs.waypoints).toEqual([
        { latitude: 2, longitude: 2 },
        { latitude: 3, longitude: 3 },
        { latitude: 4, longitude: 4 },
      ]);
    });
  });
});
