/**
 * incidentes-gestor constants - Tests
 */

import type { Theme } from '@/utils/styles';

import { createCategoriaLabels, createStatusLabels, formatIncidentDate } from '../constants';

// Mock theme object with necessary colors
const mockTheme = {
  colors: {
    error: '#FF0000',
    warning: '#FFCC00',
    success: '#00FF00',
    gray500: '#808080',
    incident: {
      accident: '#FF5500',
      absent: '#FFD700',
      wrongAddress: '#FF8800',
      blocked: '#990000',
      vehicle: '#0066FF',
      other: '#666666',
    },
  },
} as unknown as Theme;

describe('incidentes-gestor/constants', () => {
  describe('createCategoriaLabels', () => {
    it('returns all category labels', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels).toHaveProperty('accident');
      expect(labels).toHaveProperty('absent');
      expect(labels).toHaveProperty('wrong_address');
      expect(labels).toHaveProperty('blocked');
      expect(labels).toHaveProperty('vehicle');
      expect(labels).toHaveProperty('other');
    });

    it('accident label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.accident.label).toBe('Acidente/Incidente');
      expect(labels.accident.icon).toBe('warning');
      expect(labels.accident.color).toBe(mockTheme.colors.incident.accident);
    });

    it('absent label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.absent.label).toBe('Cliente ausente');
      expect(labels.absent.icon).toBe('home-outline');
      expect(labels.absent.color).toBe(mockTheme.colors.incident.absent);
    });

    it('wrong_address label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.wrong_address.label).toBe('Endereço incorreto');
      expect(labels.wrong_address.icon).toBe('location-outline');
    });

    it('blocked label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.blocked.label).toBe('Acesso bloqueado');
      expect(labels.blocked.icon).toBe('lock-closed-outline');
    });

    it('vehicle label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.vehicle.label).toBe('Problema no veículo');
      expect(labels.vehicle.icon).toBe('car-outline');
    });

    it('other label has correct properties', () => {
      const labels = createCategoriaLabels(mockTheme);

      expect(labels.other.label).toBe('Outros');
      expect(labels.other.icon).toBe('ellipsis-horizontal-outline');
    });
  });

  describe('createStatusLabels', () => {
    it('returns all status labels', () => {
      const labels = createStatusLabels(mockTheme);

      expect(labels).toHaveProperty('aberto');
      expect(labels).toHaveProperty('em_analise');
      expect(labels).toHaveProperty('resolvido');
      expect(labels).toHaveProperty('fechado');
    });

    it('aberto label has correct properties', () => {
      const labels = createStatusLabels(mockTheme);

      expect(labels.aberto.label).toBe('Aberto');
      expect(labels.aberto.color).toBe(mockTheme.colors.error);
    });

    it('em_analise label has correct properties', () => {
      const labels = createStatusLabels(mockTheme);

      expect(labels.em_analise.label).toBe('Em Análise');
      expect(labels.em_analise.color).toBe(mockTheme.colors.warning);
    });

    it('resolvido label has correct properties', () => {
      const labels = createStatusLabels(mockTheme);

      expect(labels.resolvido.label).toBe('Resolvido');
      expect(labels.resolvido.color).toBe(mockTheme.colors.success);
    });

    it('fechado label has correct properties', () => {
      const labels = createStatusLabels(mockTheme);

      expect(labels.fechado.label).toBe('Fechado');
      expect(labels.fechado.color).toBe(mockTheme.colors.gray500);
    });
  });

  describe('formatIncidentDate', () => {
    it('formats date in pt-BR format', () => {
      const dateString = '2026-01-15T14:30:00.000Z';
      const formatted = formatIncidentDate(dateString);

      // Should contain day, month, year and time
      expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it('formats another date correctly', () => {
      const dateString = '2026-06-20T09:15:00.000Z';
      const formatted = formatIncidentDate(dateString);

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });
});
