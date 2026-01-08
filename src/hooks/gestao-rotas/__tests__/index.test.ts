/**
 * gestao-rotas barrel export - Tests
 */

import {
  useRotasCache,
  useRotasFiltering,
  exportRotasToCSV,
} from '../index';

import type {
  RotaHistorico,
  RotaStatus,
  FiltroStatus,
  CachedRotas,
  SortConfig,
} from '../index';

describe('gestao-rotas/index', () => {
  describe('hook and function exports', () => {
    it('exports useRotasCache', () => {
      expect(useRotasCache).toBeDefined();
      expect(typeof useRotasCache).toBe('function');
    });

    it('exports useRotasFiltering', () => {
      expect(useRotasFiltering).toBeDefined();
      expect(typeof useRotasFiltering).toBe('function');
    });

    it('exports exportRotasToCSV', () => {
      expect(exportRotasToCSV).toBeDefined();
      expect(typeof exportRotasToCSV).toBe('function');
    });
  });

  describe('type exports', () => {
    it('exports RotaHistorico type', () => {
      const rota: RotaHistorico = {
        id: '123',
        data: '2026-01-15',
        status: 'concluida',
        paradas_count: 5,
        paradas_concluidas: 5,
      };
      expect(rota.id).toBe('123');
      expect(rota.status).toBe('concluida');
    });

    it('exports RotaStatus type', () => {
      const status: RotaStatus = 'em_andamento';
      expect(status).toBe('em_andamento');
    });

    it('exports FiltroStatus type', () => {
      const filtro: FiltroStatus = 'todas';
      expect(filtro).toBe('todas');
    });

    it('exports CachedRotas type', () => {
      const cached: CachedRotas = {
        data: [],
        timestamp: Date.now(),
      };
      expect(cached.data).toEqual([]);
      expect(cached.timestamp).toBeDefined();
    });

    it('exports SortConfig type', () => {
      const sort: SortConfig = {
        column: 'data',
        direction: 'desc',
      };
      expect(sort.column).toBe('data');
      expect(sort.direction).toBe('desc');
    });
  });
});
