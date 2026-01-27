import { render } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import { MapaAdapter } from '../MapaAdapter';

// Mock dos componentes de mapa
jest.mock('../MapaMobile', () => ({
  MapaMobile: jest.fn(() => null),
}));

// Mock MapaWebMapLibre (migrado de Google Maps para MapLibre)
jest.mock('../MapaWebMapLibre', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockMapaMobile = require('../MapaMobile').MapaMobile;
const mockMapaWebMapLibre = require('../MapaWebMapLibre').default;

describe('MapaAdapter', () => {
  const mockParadas = [
    {
      id: '1',
      ordem: 1,
      endereco: 'Rua Teste, 123',
      latitude: -23.5505,
      longitude: -46.6333,
      status: 'pendente',
      tipo: 'entrega',
      is_checkpoint: false,
    },
    {
      id: '2',
      ordem: 2,
      endereco: 'Av. Exemplo, 456',
      latitude: -23.5489,
      longitude: -46.6388,
      status: 'concluida',
      tipo: 'retirada',
      is_checkpoint: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Plataforma Web', () => {
    beforeEach(() => {
      // Mock Platform.OS como 'web'
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'web'),
        configurable: true,
      });
    });

    it('deve renderizar MapaWeb quando Platform.OS é "web"', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalledTimes(1);
      expect(mockMapaMobile).not.toHaveBeenCalled();
    });

    it('deve passar paradas para MapaWeb', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(mockParadas);
    });

    it('deve renderizar MapaWeb com paradas vazias', () => {
      render(<MapaAdapter paradas={[]} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual([]);
    });
  });

  describe('Plataforma iOS', () => {
    beforeEach(() => {
      // Mock Platform.OS como 'ios'
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'ios'),
        configurable: true,
      });
    });

    it('deve renderizar MapaMobile quando Platform.OS é "ios"', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalledTimes(1);
      expect(mockMapaWebMapLibre).not.toHaveBeenCalled();
    });

    it('deve passar paradas para MapaMobile', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(mockParadas);
    });
  });

  describe('Plataforma Android', () => {
    beforeEach(() => {
      // Mock Platform.OS como 'android'
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'android'),
        configurable: true,
      });
    });

    it('deve renderizar MapaMobile quando Platform.OS é "android"', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalledTimes(1);
      expect(mockMapaWebMapLibre).not.toHaveBeenCalled();
    });

    it('deve passar paradas para MapaMobile', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(mockParadas);
    });
  });

  describe('Diferentes tipos de paradas', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'web'),
        configurable: true,
      });
    });

    it('deve lidar com paradas sem coordenadas', () => {
      const paradasSemCoordenadas = [
        {
          id: '1',
          ordem: 1,
          endereco: 'Rua sem coordenadas',
          latitude: null,
          longitude: null,
          status: 'pendente',
        },
      ];

      render(<MapaAdapter paradas={paradasSemCoordenadas} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(paradasSemCoordenadas);
    });

    it('deve lidar com paradas sem tipo', () => {
      const paradasSemTipo = [
        {
          id: '1',
          ordem: 1,
          endereco: 'Rua Exemplo',
          latitude: -23.5505,
          longitude: -46.6333,
          status: 'pendente',
        },
      ];

      render(<MapaAdapter paradas={paradasSemTipo} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(paradasSemTipo);
    });

    it('deve lidar com paradas sem is_checkpoint', () => {
      const paradasSemCheckpoint = [
        {
          id: '1',
          ordem: 1,
          endereco: 'Rua Exemplo',
          latitude: -23.5505,
          longitude: -46.6333,
          status: 'pendente',
          tipo: 'entrega',
        },
      ];

      render(<MapaAdapter paradas={paradasSemCheckpoint} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(paradasSemCheckpoint);
    });

    it('deve lidar com múltiplas paradas de diferentes tipos', () => {
      const paradasMistas = [
        {
          id: '1',
          ordem: 1,
          endereco: 'Entrega 1',
          latitude: -23.5505,
          longitude: -46.6333,
          status: 'pendente',
          tipo: 'entrega',
        },
        {
          id: '2',
          ordem: 2,
          endereco: 'Retirada 1',
          latitude: -23.5489,
          longitude: -46.6388,
          status: 'concluida',
          tipo: 'retirada',
        },
        {
          id: '3',
          ordem: 3,
          endereco: 'Checkpoint',
          latitude: -23.5600,
          longitude: -46.6500,
          status: 'pendente',
          tipo: 'entrega',
          is_checkpoint: true,
        },
      ];

      render(<MapaAdapter paradas={paradasMistas} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(paradasMistas);
    });
  });

  describe('Props vazias ou edge cases', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        get: jest.fn(() => 'web'),
        configurable: true,
      });
    });

    it('deve renderizar com array vazio de paradas', () => {
      render(<MapaAdapter paradas={[]} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar com uma única parada', () => {
      const unicaParada = [mockParadas[0]];

      render(<MapaAdapter paradas={unicaParada} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(unicaParada);
    });

    it('deve renderizar com muitas paradas', () => {
      const muitasParadas = Array.from({ length: 50 }, (_, i) => ({
        id: `parada-${i}`,
        ordem: i + 1,
        endereco: `Rua ${i}`,
        latitude: -23.5505 + i * 0.01,
        longitude: -46.6333 + i * 0.01,
        status: i % 2 === 0 ? 'pendente' : 'concluida',
      }));

      render(<MapaAdapter paradas={muitasParadas} />);

      expect(mockMapaWebMapLibre).toHaveBeenCalled();
      const callArgs = mockMapaWebMapLibre.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(muitasParadas);
    });
  });
});
