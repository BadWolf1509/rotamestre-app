/**
 * incidentes-gestor barrel export - Tests
 */

import {
  createCategoriaLabels,
  createStatusLabels,
  formatIncidentDate,
  useIncidentesStats,
  useIncidentesModals,
} from '../index';

import type {
  Incidente,
  FiltroStatus,
  FiltroCategoria,
  CategoriaLabel,
  StatusLabel,
  EstatisticaMotorista,
  ResumoGeral,
} from '../index';

describe('incidentes-gestor/index', () => {
  describe('function exports', () => {
    it('exports createCategoriaLabels', () => {
      expect(createCategoriaLabels).toBeDefined();
      expect(typeof createCategoriaLabels).toBe('function');
    });

    it('exports createStatusLabels', () => {
      expect(createStatusLabels).toBeDefined();
      expect(typeof createStatusLabels).toBe('function');
    });

    it('exports formatIncidentDate', () => {
      expect(formatIncidentDate).toBeDefined();
      expect(typeof formatIncidentDate).toBe('function');
    });

    it('exports useIncidentesStats', () => {
      expect(useIncidentesStats).toBeDefined();
      expect(typeof useIncidentesStats).toBe('function');
    });

    it('exports useIncidentesModals', () => {
      expect(useIncidentesModals).toBeDefined();
      expect(typeof useIncidentesModals).toBe('function');
    });
  });

  describe('type exports', () => {
    it('exports Incidente type', () => {
      const incidente: Partial<Incidente> = {
        id: '123',
        categoria: 'accident',
        status: 'aberto',
      };
      expect(incidente.id).toBe('123');
    });

    it('exports FiltroStatus type', () => {
      const status: FiltroStatus = 'aberto';
      expect(status).toBe('aberto');
    });

    it('exports FiltroCategoria type', () => {
      const categoria: FiltroCategoria = 'accident';
      expect(categoria).toBe('accident');
    });

    it('exports CategoriaLabel type', () => {
      const label: CategoriaLabel = {
        label: 'Test',
        icon: 'warning' as any,
        color: '#FF0000',
      };
      expect(label.label).toBe('Test');
    });

    it('exports StatusLabel type', () => {
      const label: StatusLabel = {
        label: 'Test',
        color: '#FF0000',
      };
      expect(label.label).toBe('Test');
    });

    it('exports EstatisticaMotorista type', () => {
      const stats: EstatisticaMotorista = {
        id: '123',
        nome: 'Test Driver',
        total: 10,
        abertos: 3,
        resolvidos: 7,
      };
      expect(stats.total).toBe(10);
    });

    it('exports ResumoGeral type', () => {
      const resumo: ResumoGeral = {
        total: 100,
        abertos: 20,
        emAnalise: 15,
        resolvidos: 50,
        fechados: 15,
        porCategoria: { accident: 10, other: 5 },
      };
      expect(resumo.total).toBe(100);
    });
  });
});
