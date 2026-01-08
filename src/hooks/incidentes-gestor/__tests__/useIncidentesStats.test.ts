/**
 * useIncidentesStats - Tests
 */

import { renderHook } from '@testing-library/react-native';

import { useIncidentesStats } from '../useIncidentesStats';
import type { Incidente } from '../types';

const createMockIncidente = (overrides: Partial<Incidente> = {}): Incidente => ({
  id: `inc-${Math.random().toString(36).substr(2, 9)}`,
  categoria: 'accident',
  descricao: 'Test incident',
  endereco: 'Test address',
  status: 'aberto',
  foto_url: null,
  created_at: '2026-01-15T10:00:00Z',
  motorista_nome: 'João Silva',
  motorista_id: 'driver-1',
  unidade_nome: 'Unit Test',
  rota_id: null,
  rota_data: null,
  parada_endereco: null,
  observacoes_gestao: null,
  ...overrides,
});

describe('useIncidentesStats', () => {
  describe('empty incidentes', () => {
    it('returns empty statistics for empty array', () => {
      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes: [] })
      );

      expect(result.current.estatisticasMotorista).toEqual([]);
      expect(result.current.resumoGeral).toEqual({
        total: 0,
        abertos: 0,
        emAnalise: 0,
        resolvidos: 0,
        fechados: 0,
        porCategoria: {},
      });
    });
  });

  describe('estatisticasMotorista', () => {
    it('counts incidents per driver', () => {
      const incidentes: Incidente[] = [
        createMockIncidente({ motorista_id: 'driver-1', motorista_nome: 'João' }),
        createMockIncidente({ motorista_id: 'driver-1', motorista_nome: 'João' }),
        createMockIncidente({ motorista_id: 'driver-2', motorista_nome: 'Maria' }),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.estatisticasMotorista).toHaveLength(2);
      expect(result.current.estatisticasMotorista[0].total).toBe(2); // João has more
      expect(result.current.estatisticasMotorista[1].total).toBe(1);
    });

    it('counts abertos and resolvidos separately', () => {
      const incidentes: Incidente[] = [
        createMockIncidente({ motorista_id: 'driver-1', status: 'aberto' }),
        createMockIncidente({ motorista_id: 'driver-1', status: 'em_analise' }),
        createMockIncidente({ motorista_id: 'driver-1', status: 'resolvido' }),
        createMockIncidente({ motorista_id: 'driver-1', status: 'fechado' }),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      const driver = result.current.estatisticasMotorista[0];
      expect(driver.total).toBe(4);
      expect(driver.abertos).toBe(2); // aberto + em_analise
      expect(driver.resolvidos).toBe(2); // resolvido + fechado
    });

    it('limits to top 5 drivers by incident count', () => {
      const incidentes: Incidente[] = [];
      for (let i = 1; i <= 7; i++) {
        for (let j = 0; j < i; j++) {
          incidentes.push(
            createMockIncidente({
              motorista_id: `driver-${i}`,
              motorista_nome: `Driver ${i}`,
            })
          );
        }
      }

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.estatisticasMotorista).toHaveLength(5);
      // Top 5 should be drivers 7, 6, 5, 4, 3 (by count)
      expect(result.current.estatisticasMotorista[0].nome).toBe('Driver 7');
      expect(result.current.estatisticasMotorista[4].nome).toBe('Driver 3');
    });

    it('sorts drivers by total count descending', () => {
      const incidentes: Incidente[] = [
        createMockIncidente({ motorista_id: 'driver-1', motorista_nome: 'João' }),
        createMockIncidente({ motorista_id: 'driver-2', motorista_nome: 'Maria' }),
        createMockIncidente({ motorista_id: 'driver-2', motorista_nome: 'Maria' }),
        createMockIncidente({ motorista_id: 'driver-2', motorista_nome: 'Maria' }),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.estatisticasMotorista[0].nome).toBe('Maria');
      expect(result.current.estatisticasMotorista[0].total).toBe(3);
      expect(result.current.estatisticasMotorista[1].nome).toBe('João');
      expect(result.current.estatisticasMotorista[1].total).toBe(1);
    });
  });

  describe('resumoGeral', () => {
    it('counts total incidents', () => {
      const incidentes: Incidente[] = [
        createMockIncidente(),
        createMockIncidente(),
        createMockIncidente(),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.resumoGeral.total).toBe(3);
    });

    it('counts incidents by status', () => {
      const incidentes: Incidente[] = [
        createMockIncidente({ status: 'aberto' }),
        createMockIncidente({ status: 'aberto' }),
        createMockIncidente({ status: 'em_analise' }),
        createMockIncidente({ status: 'resolvido' }),
        createMockIncidente({ status: 'resolvido' }),
        createMockIncidente({ status: 'resolvido' }),
        createMockIncidente({ status: 'fechado' }),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.resumoGeral.abertos).toBe(2);
      expect(result.current.resumoGeral.emAnalise).toBe(1);
      expect(result.current.resumoGeral.resolvidos).toBe(3);
      expect(result.current.resumoGeral.fechados).toBe(1);
    });

    it('counts incidents by category', () => {
      const incidentes: Incidente[] = [
        createMockIncidente({ categoria: 'accident' }),
        createMockIncidente({ categoria: 'accident' }),
        createMockIncidente({ categoria: 'absent' }),
        createMockIncidente({ categoria: 'vehicle' }),
        createMockIncidente({ categoria: 'vehicle' }),
        createMockIncidente({ categoria: 'vehicle' }),
      ];

      const { result } = renderHook(() =>
        useIncidentesStats({ incidentes })
      );

      expect(result.current.resumoGeral.porCategoria).toEqual({
        accident: 2,
        absent: 1,
        vehicle: 3,
      });
    });
  });
});
