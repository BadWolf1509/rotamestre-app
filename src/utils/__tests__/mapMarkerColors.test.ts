/**
 * Tests for mapMarkerColors utility
 *
 * Verifies marker fill colors for each status and the MapLibre GL expression.
 */

import {
  getMarkerFillColor,
  getMarkerColorExpression,
} from '../mapMarkerColors';

const mockColors = {
  primary: '#284093',
  successDark: '#047857',
  warningDark: '#d97706',
  errorDark: '#dc2626',
  gray500: '#6b7280',
};

describe('mapMarkerColors', () => {
  describe('getMarkerFillColor', () => {
    it('returns successDark for concluida', () => {
      expect(getMarkerFillColor('concluida', mockColors)).toBe(
        mockColors.successDark,
      );
    });

    it('returns primary for em_andamento (info mapped to primary for WCAG)', () => {
      expect(getMarkerFillColor('em_andamento', mockColors)).toBe(
        mockColors.primary,
      );
    });

    it('returns warningDark for pendente', () => {
      expect(getMarkerFillColor('pendente', mockColors)).toBe(
        mockColors.warningDark,
      );
    });

    it('returns gray500 for pulada (short-circuit before statusConfig lookup)', () => {
      // pulada is 'warning' in statusConfig, but the marker override returns gray
      expect(getMarkerFillColor('pulada', mockColors)).toBe(mockColors.gray500);
    });

    it('returns errorDark for cancelada', () => {
      expect(getMarkerFillColor('cancelada', mockColors)).toBe(
        mockColors.errorDark,
      );
    });

    it('returns primary for unknown status (statusConfig defaults to info)', () => {
      // getStatusColorKey returns 'info' for unrecognized statuses,
      // which maps to primary in the switch
      expect(getMarkerFillColor('unknown_status', mockColors)).toBe(
        mockColors.primary,
      );
    });
  });

  describe('getMarkerColorExpression', () => {
    const expression = getMarkerColorExpression(mockColors);

    it('returns an array starting with "case"', () => {
      expect(Array.isArray(expression)).toBe(true);
      expect(expression[0]).toBe('case');
    });

    // Partida e chegada saíram das features (08/11/2026): são o pino da
    // unidade (`pontosDaUnidade`), azul-marinho, fora da escala de status. O
    // ramo antigo pintava a chegada de vermelho — a cor de "não executada".
    it('não pinta partida nem chegada (são o pino da unidade)', () => {
      const serialized = JSON.stringify(expression);
      expect(serialized).not.toContain('is_checkpoint');
      expect(serialized).not.toContain('is_partida');
    });

    it('contains all 4 stop statuses', () => {
      const serialized = JSON.stringify(expression);
      expect(serialized).toContain('concluida');
      expect(serialized).toContain('em_andamento');
      expect(serialized).toContain('pendente');
      expect(serialized).toContain('pulada');
    });

    it('uses correct colors from the ThemeColors input', () => {
      const serialized = JSON.stringify(expression);
      expect(serialized).toContain(mockColors.successDark);
      expect(serialized).toContain(mockColors.primary);
      expect(serialized).toContain(mockColors.warningDark);
      expect(serialized).toContain(mockColors.gray500);
    });

    it('começa pelo status da parada', () => {
      expect(expression[1]).toEqual(['==', ['get', 'status'], 'concluida']);
      expect(expression[2]).toBe(mockColors.successDark);
    });

    it('ends with gray500 as the final fallback', () => {
      expect(expression[expression.length - 1]).toBe(mockColors.gray500);
    });
  });
});
