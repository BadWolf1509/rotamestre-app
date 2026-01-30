import { render } from '@testing-library/react-native';
import React from 'react';

import { MapaAdapter } from '../MapaAdapter';

/**
 * MapaAdapter Tests
 *
 * Nota: A arquitetura usa platform-specific file resolution do Metro:
 * - MapaAdapter.tsx (mobile) → sempre usa MapaMobile
 * - MapaAdapter.web.tsx (web) → sempre usa MapaWebMapLibre
 *
 * Jest resolve apenas MapaAdapter.tsx, então testamos a versão mobile.
 */

// Mock do componente de mapa mobile
jest.mock('../MapaMobile', () => ({
  MapaMobile: jest.fn(() => null),
}));

const mockMapaMobile = require('../MapaMobile').MapaMobile;

describe('MapaAdapter (Mobile)', () => {
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

  describe('Renderização', () => {
    it('deve renderizar MapaMobile', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalledTimes(1);
    });

    it('deve passar paradas para MapaMobile', () => {
      render(<MapaAdapter paradas={mockParadas} />);

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(mockParadas);
    });

    it('deve renderizar com paradas vazias', () => {
      render(<MapaAdapter paradas={[]} />);

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual([]);
    });
  });

  describe('Props opcionais', () => {
    it('deve passar selectedParadaId', () => {
      render(<MapaAdapter paradas={mockParadas} selectedParadaId="1" />);

      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.selectedParadaId).toBe('1');
    });

    it('deve passar callbacks', () => {
      const onMarkerPress = jest.fn();
      const onMapPress = jest.fn();

      render(
        <MapaAdapter
          paradas={mockParadas}
          onMarkerPress={onMarkerPress}
          onMapPress={onMapPress}
        />
      );

      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.onMarkerPress).toBe(onMarkerPress);
      expect(callArgs.onMapPress).toBe(onMapPress);
    });

    it('deve passar statusFilter', () => {
      render(<MapaAdapter paradas={mockParadas} statusFilter="pendente" />);

      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.statusFilter).toBe('pendente');
    });

    it('deve passar props de rota e motorista', () => {
      render(
        <MapaAdapter
          paradas={mockParadas}
          rotaId="rota-123"
          motoristaNome="João"
          showMotorista={true}
          unidadeNome="Unidade Centro"
        />
      );

      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.rotaId).toBe('rota-123');
      expect(callArgs.motoristaNome).toBe('João');
      expect(callArgs.showMotorista).toBe(true);
      expect(callArgs.unidadeNome).toBe('Unidade Centro');
    });
  });

  describe('Diferentes tipos de paradas', () => {
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

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
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

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
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

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
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

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(paradasMistas);
    });
  });

  describe('Edge cases', () => {
    it('deve renderizar com uma única parada', () => {
      const unicaParada = [mockParadas[0]];

      render(<MapaAdapter paradas={unicaParada} />);

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
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

      expect(mockMapaMobile).toHaveBeenCalled();
      const callArgs = mockMapaMobile.mock.calls[0][0];
      expect(callArgs.paradas).toEqual(muitasParadas);
    });
  });
});
