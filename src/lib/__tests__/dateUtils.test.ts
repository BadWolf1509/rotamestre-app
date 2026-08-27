/**
 * Testes para utilitários de manipulação de datas
 * @file src/lib/__tests__/dateUtils.test.ts
 */

import {
  parseLocalDate,
  formatDateBR,
  formatDateTimeBR,
  formatTimeBR,
  getTodayISO,
  isToday,
  isPast,
  daysDifference,
} from '../dateUtils';

// Helper para criar string ISO local (evita problemas de timezone)
function toLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('lib/dateUtils', () => {
  // ============================================================================
  // parseLocalDate
  // ============================================================================
  describe('parseLocalDate', () => {
    it('deve fazer parse de data válida no formato YYYY-MM-DD', () => {
      const result = parseLocalDate('2025-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0); // Janeiro = 0
      expect(result?.getDate()).toBe(15);
    });

    it('deve fazer parse de data no início do ano', () => {
      const result = parseLocalDate('2025-01-01');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(1);
    });

    it('deve fazer parse de data no final do ano', () => {
      const result = parseLocalDate('2025-12-31');
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(11); // Dezembro = 11
      expect(result?.getDate()).toBe(31);
    });

    it('deve retornar null para string vazia', () => {
      expect(parseLocalDate('')).toBeNull();
    });

    it('deve retornar null para null', () => {
      expect(parseLocalDate(null)).toBeNull();
    });

    it('deve retornar null para undefined', () => {
      expect(parseLocalDate(undefined)).toBeNull();
    });

    it('deve retornar null para formato inválido sem separadores', () => {
      expect(parseLocalDate('20250115')).toBeNull();
    });

    it('deve retornar null para formato DD/MM/YYYY', () => {
      const result = parseLocalDate('15/01/2025');
      // Retorna null porque split('-') não funciona
      expect(result).toBeNull();
    });

    it('deve retornar null para data parcial (apenas ano-mês)', () => {
      const result = parseLocalDate('2025-01');
      expect(result).toBeNull();
    });

    it('deve retornar null para data parcial (apenas ano)', () => {
      const result = parseLocalDate('2025');
      expect(result).toBeNull();
    });

    it('deve criar data local sem problemas de timezone', () => {
      // Teste importante: garantir que não há shift de dia por timezone
      const result = parseLocalDate('2025-06-15');
      expect(result?.getDate()).toBe(15);
      expect(result?.getMonth()).toBe(5); // Junho = 5
    });
  });

  // ============================================================================
  // formatDateBR
  // ============================================================================
  describe('formatDateBR', () => {
    it('deve formatar data para DD/MM/YYYY', () => {
      const result = formatDateBR('2025-01-15');
      expect(result).toBe('15/01/2025');
    });

    it('deve formatar data com dia/mês de um dígito com zero à esquerda', () => {
      const result = formatDateBR('2025-05-03');
      expect(result).toBe('03/05/2025');
    });

    it('deve formatar data do final do ano', () => {
      const result = formatDateBR('2025-12-31');
      expect(result).toBe('31/12/2025');
    });

    it('deve retornar "-" para null', () => {
      expect(formatDateBR(null)).toBe('-');
    });

    it('deve retornar "-" para undefined', () => {
      expect(formatDateBR(undefined)).toBe('-');
    });

    it('deve retornar "-" para string vazia', () => {
      expect(formatDateBR('')).toBe('-');
    });

    it('deve retornar "-" para formato inválido', () => {
      expect(formatDateBR('invalid-date')).toBe('-');
    });

    it('deve formatar corretamente ano bissexto', () => {
      const result = formatDateBR('2024-02-29');
      expect(result).toBe('29/02/2024');
    });
  });

  // ============================================================================
  // formatDateTimeBR
  // ============================================================================
  describe('formatDateTimeBR', () => {
    it('deve formatar data/hora ISO sem opções', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:00Z');
      // Formato padrão: DD/MM, HH:MM (sem ano, sem segundos)
      expect(result).toMatch(/\d{2}\/\d{2}, \d{2}:\d{2}/);
    });

    it('deve formatar data/hora com ano quando showYear=true', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:00Z', {
        showYear: true,
      });
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('deve formatar data/hora com segundos quando showSeconds=true', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:45Z', {
        showSeconds: true,
      });
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('deve formatar com ano e segundos', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:45Z', {
        showYear: true,
        showSeconds: true,
      });
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('deve retornar "-" para null', () => {
      expect(formatDateTimeBR(null)).toBe('-');
    });

    it('deve retornar "-" para undefined', () => {
      expect(formatDateTimeBR(undefined)).toBe('-');
    });

    it('deve retornar "-" para string vazia', () => {
      expect(formatDateTimeBR('')).toBe('-');
    });

    it('deve retornar "-" para data inválida', () => {
      expect(formatDateTimeBR('not-a-date')).toBe('-');
    });

    it('deve retornar "-" para data NaN', () => {
      expect(formatDateTimeBR('invalid')).toBe('-');
    });

    it('deve aceitar timestamp numérico como string', () => {
      // Timestamp de 2025-01-15T12:00:00Z
      const timestamp = '2025-01-15T12:00:00.000Z';
      const result = formatDateTimeBR(timestamp);
      expect(result).not.toBe('-');
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });

    it('deve formatar data com timezone offset', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:00-03:00');
      expect(result).not.toBe('-');
      expect(result).toMatch(/\d{2}\/\d{2}/);
    });

    it('deve usar opções padrão quando não fornecidas', () => {
      const result = formatDateTimeBR('2025-01-15T14:30:00Z', {});
      // Sem ano, sem segundos
      expect(result).toMatch(/^\d{2}\/\d{2}, \d{2}:\d{2}$/);
    });
  });

  // ============================================================================
  // getTodayISO
  // ============================================================================
  describe('getTodayISO', () => {
    it('deve retornar data no formato YYYY-MM-DD', () => {
      const result = getTodayISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('deve retornar a data de hoje', () => {
      const result = getTodayISO();
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expected = `${year}-${month}-${day}`;
      expect(result).toBe(expected);
    });

    it('deve ter comprimento de 10 caracteres', () => {
      const result = getTodayISO();
      expect(result.length).toBe(10);
    });

    it('deve conter dois hífens', () => {
      const result = getTodayISO();
      const hyphens = result.split('-').length - 1;
      expect(hyphens).toBe(2);
    });
  });

  // ============================================================================
  // isToday
  // ============================================================================
  describe('isToday', () => {
    it('deve retornar true para data de hoje', () => {
      const today = getTodayISO();
      expect(isToday(today)).toBe(true);
    });

    it('deve retornar false para data de ontem', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = toLocalISO(yesterday);
      expect(isToday(yesterdayISO)).toBe(false);
    });

    it('deve retornar false para data de amanhã', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = toLocalISO(tomorrow);
      expect(isToday(tomorrowISO)).toBe(false);
    });

    it('deve retornar false para null', () => {
      expect(isToday(null)).toBe(false);
    });

    it('deve retornar false para undefined', () => {
      expect(isToday(undefined)).toBe(false);
    });

    it('deve retornar false para string vazia', () => {
      expect(isToday('')).toBe(false);
    });

    it('deve retornar false para data inválida', () => {
      expect(isToday('invalid-date')).toBe(false);
    });

    it('deve retornar false para data de ano passado mesmo dia/mês', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const lastYearISO = toLocalISO(lastYear);
      expect(isToday(lastYearISO)).toBe(false);
    });

    it('deve retornar false para data de ano próximo mesmo dia/mês', () => {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearISO = toLocalISO(nextYear);
      expect(isToday(nextYearISO)).toBe(false);
    });
  });

  // ============================================================================
  // isPast
  // ============================================================================
  describe('isPast', () => {
    it('deve retornar false para data de hoje', () => {
      const today = getTodayISO();
      expect(isPast(today)).toBe(false);
    });

    it('deve retornar true para data de ontem', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = toLocalISO(yesterday);
      expect(isPast(yesterdayISO)).toBe(true);
    });

    it('deve retornar false para data de amanhã', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = toLocalISO(tomorrow);
      expect(isPast(tomorrowISO)).toBe(false);
    });

    it('deve retornar true para data de uma semana atrás', () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastWeekISO = toLocalISO(lastWeek);
      expect(isPast(lastWeekISO)).toBe(true);
    });

    it('deve retornar true para data de um ano atrás', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const lastYearISO = toLocalISO(lastYear);
      expect(isPast(lastYearISO)).toBe(true);
    });

    it('deve retornar false para null', () => {
      expect(isPast(null)).toBe(false);
    });

    it('deve retornar false para undefined', () => {
      expect(isPast(undefined)).toBe(false);
    });

    it('deve retornar false para string vazia', () => {
      expect(isPast('')).toBe(false);
    });

    it('deve retornar false para data inválida', () => {
      expect(isPast('invalid-date')).toBe(false);
    });

    it('deve retornar false para data futura distante', () => {
      expect(isPast('2099-12-31')).toBe(false);
    });

    it('deve retornar true para data passada distante', () => {
      expect(isPast('2000-01-01')).toBe(true);
    });
  });

  // ============================================================================
  // daysDifference
  // ============================================================================
  describe('daysDifference', () => {
    it('deve retornar 0 para mesma data', () => {
      expect(daysDifference('2025-01-15', '2025-01-15')).toBe(0);
    });

    it('deve retornar 1 para datas consecutivas', () => {
      expect(daysDifference('2025-01-15', '2025-01-16')).toBe(1);
    });

    it('deve retornar valor absoluto (ordem não importa)', () => {
      expect(daysDifference('2025-01-16', '2025-01-15')).toBe(1);
    });

    it('deve calcular diferença de uma semana', () => {
      expect(daysDifference('2025-01-01', '2025-01-08')).toBe(7);
    });

    it('deve calcular diferença de um mês (31 dias)', () => {
      expect(daysDifference('2025-01-01', '2025-02-01')).toBe(31);
    });

    it('deve calcular diferença de um ano (365 dias)', () => {
      // 2025 não é bissexto
      expect(daysDifference('2025-01-01', '2026-01-01')).toBe(365);
    });

    it('deve calcular diferença de um ano bissexto (366 dias)', () => {
      expect(daysDifference('2024-01-01', '2025-01-01')).toBe(366);
    });

    it('deve retornar null se primeira data é null', () => {
      expect(daysDifference(null, '2025-01-15')).toBeNull();
    });

    it('deve retornar null se segunda data é null', () => {
      expect(daysDifference('2025-01-15', null)).toBeNull();
    });

    it('deve retornar null se ambas datas são null', () => {
      expect(daysDifference(null, null)).toBeNull();
    });

    it('deve retornar null se primeira data é undefined', () => {
      expect(daysDifference(undefined, '2025-01-15')).toBeNull();
    });

    it('deve retornar null se segunda data é undefined', () => {
      expect(daysDifference('2025-01-15', undefined)).toBeNull();
    });

    it('deve retornar null se primeira data é string vazia', () => {
      expect(daysDifference('', '2025-01-15')).toBeNull();
    });

    it('deve retornar null se segunda data é string vazia', () => {
      expect(daysDifference('2025-01-15', '')).toBeNull();
    });

    it('deve retornar null se primeira data é inválida', () => {
      expect(daysDifference('invalid', '2025-01-15')).toBeNull();
    });

    it('deve retornar null se segunda data é inválida', () => {
      expect(daysDifference('2025-01-15', 'invalid')).toBeNull();
    });

    it('deve calcular diferença entre datas de anos diferentes', () => {
      const diff = daysDifference('2020-01-01', '2025-01-01');
      expect(diff).toBeGreaterThan(1825); // ~5 anos
      expect(diff).toBeLessThan(1830);
    });

    it('deve calcular diferença de 100 dias', () => {
      expect(daysDifference('2025-01-01', '2025-04-11')).toBe(100);
    });

    it('deve calcular diferença cruzando virada de ano', () => {
      expect(daysDifference('2024-12-31', '2025-01-01')).toBe(1);
    });

    it('deve calcular diferença cruzando fevereiro em ano bissexto', () => {
      // De 1 de fevereiro a 1 de março em 2024 (bissexto) = 29 dias
      expect(daysDifference('2024-02-01', '2024-03-01')).toBe(29);
    });

    it('deve calcular diferença cruzando fevereiro em ano não bissexto', () => {
      // De 1 de fevereiro a 1 de março em 2025 (não bissexto) = 28 dias
      expect(daysDifference('2025-02-01', '2025-03-01')).toBe(28);
    });
  });

  // ============================================================================
  // Testes de integração entre funções
  // ============================================================================
  describe('integração entre funções', () => {
    it('parseLocalDate + formatDateBR deve fazer round-trip', () => {
      const original = '2025-06-15';
      const parsed = parseLocalDate(original);
      expect(parsed).not.toBeNull();
      // formatDateBR retorna DD/MM/YYYY
      const formatted = formatDateBR(original);
      expect(formatted).toBe('15/06/2025');
    });

    it('getTodayISO deve retornar data que isToday considera true', () => {
      const today = getTodayISO();
      expect(isToday(today)).toBe(true);
    });

    it('getTodayISO deve retornar data que isPast considera false', () => {
      const today = getTodayISO();
      expect(isPast(today)).toBe(false);
    });

    it('daysDifference com getTodayISO e ontem deve ser 1', () => {
      const today = getTodayISO();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = toLocalISO(yesterday);
      expect(daysDifference(today, yesterdayISO)).toBe(1);
    });
  });

  // ============================================================================
  // Testes de edge cases de timezone
  // ============================================================================
  describe('tratamento de timezone', () => {
    it('parseLocalDate não deve ter shift de dia perto da meia-noite', () => {
      // Datas que podem causar problemas com UTC
      const dates = ['2025-01-01', '2025-06-15', '2025-12-31'];

      dates.forEach((dateStr) => {
        const parsed = parseLocalDate(dateStr);
        const [, , day] = dateStr.split('-').map(Number);
        expect(parsed?.getDate()).toBe(day);
      });
    });

    it('formatDateBR deve manter o dia correto independente do timezone', () => {
      // Teste de datas que historicamente causam problemas
      expect(formatDateBR('2025-01-01')).toBe('01/01/2025');
      expect(formatDateBR('2025-06-30')).toBe('30/06/2025');
      expect(formatDateBR('2025-12-31')).toBe('31/12/2025');
    });

    it('formatDateTimeBR deve formatar corretamente ISO com Z', () => {
      const result = formatDateTimeBR('2025-01-15T00:00:00Z');
      expect(result).not.toBe('-');
    });

    it('formatDateTimeBR deve formatar corretamente ISO com offset', () => {
      const result = formatDateTimeBR('2025-01-15T00:00:00+00:00');
      expect(result).not.toBe('-');
    });

    it('formatDateTimeBR deve formatar corretamente ISO com offset negativo', () => {
      const result = formatDateTimeBR('2025-01-15T00:00:00-03:00');
      expect(result).not.toBe('-');
    });
  });

  describe('formatTimeBR', () => {
    // Datas sem offset sao interpretadas como hora LOCAL, entao estes testes
    // independem do fuso da maquina que roda a suite.
    it('deve formatar hora e minuto com dois digitos', () => {
      expect(formatTimeBR('2026-08-27T07:43:26')).toBe('07:43');
    });

    it('deve preservar horario da tarde sem converter para 12h', () => {
      expect(formatTimeBR('2026-08-27T22:00:00')).toBe('22:00');
    });

    it('deve zerar-preencher a meia-noite', () => {
      expect(formatTimeBR('2026-08-27T00:05:00')).toBe('00:05');
    });

    it('deve converter timestamp UTC para o horario local do aparelho', () => {
      // Mesmo instante escrito das duas formas: o resultado tem de ser igual.
      const comZ = formatTimeBR('2026-08-27T10:43:26Z');
      const equivalente = new Date('2026-08-27T10:43:26Z');
      const esperado = `${String(equivalente.getHours()).padStart(2, '0')}:${String(
        equivalente.getMinutes(),
      ).padStart(2, '0')}`;
      expect(comZ).toBe(esperado);
    });

    it('deve devolver "-" para entrada vazia ou invalida', () => {
      expect(formatTimeBR(null)).toBe('-');
      expect(formatTimeBR(undefined)).toBe('-');
      expect(formatTimeBR('')).toBe('-');
      expect(formatTimeBR('nao e uma data')).toBe('-');
    });
  });
});
