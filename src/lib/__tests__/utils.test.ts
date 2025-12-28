import {
  formatBytes,
  formatDuration,
  debounce,
  throttle,
  deepClone,
  generateId,
  sleep,
  retryWithBackoff,
  chunk,
  unique,
  groupBy,
  sortBy,
  memoize,
  isEmpty,
  safeJsonParse,
  formatPercentage,
  clamp,
  lerp,
  mapRange,
  // Timeline functions
  mapLogToTimelineEvent,
  mapParadaToTimelineEvent,
  mapIncidenteToTimelineEvent,
  formatRelativeTime,
  getDateGroup,
  calculateDurationBetween,
  INCIDENTE_LABELS,
  CRITICAL_INCIDENT_CATEGORIES,
} from '../utils';

describe('lib/utils', () => {
  describe('formatters', () => {
    it('formatBytes deve formatar corretamente', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1234)).toBe('1.21 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('formatDuration deve formatar corretamente', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(65000)).toBe('1min 5s');
      expect(formatDuration(3665000)).toBe('1h 1min');
    });

    it('formatPercentage deve formatar corretamente', () => {
      expect(formatPercentage(0.123)).toBe('12.3%');
      expect(formatPercentage(0.5, 0)).toBe('50%');
    });
  });

  describe('control flow', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('debounce deve atrasar execução', () => {
      jest.useFakeTimers(); // Re-enable for this test block if needed, or rely on describe block
      const func = jest.fn();
      const debounced = debounce(func, 1000);

      debounced();
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      debounced(); // Reset timer
      jest.advanceTimersByTime(500);
      expect(func).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('throttle deve limitar execução', () => {
      const func = jest.fn();
      const throttled = throttle(func, 1000);

      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      throttled();
      expect(func).toHaveBeenCalledTimes(1); // Ignorado

      jest.advanceTimersByTime(1000);
      throttled();
      expect(func).toHaveBeenCalledTimes(2);
    });

    it('sleep deve aguardar tempo', async () => {
      const promise = sleep(1000);

      // Avançar o tempo para resolver o sleep
      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
    });

    it('retryWithBackoff deve tentar novamente em caso de erro', async () => {
      const func = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('Success');

      const promise = retryWithBackoff(func, 3, 100);

      // Avançar timers para cobrir os backoffs
      // 1ª tentativa falha -> espera 100ms
      // 2ª tentativa falha -> espera 200ms
      // 3ª tentativa sucesso

      // Precisamos avançar o tempo e permitir que as promises se resolvam
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve(); // Tick do event loop
      }

      await expect(promise).resolves.toBe('Success');
      expect(func).toHaveBeenCalledTimes(3);
    });

    it('retryWithBackoff deve falhar após max retries', async () => {
      const func = jest.fn().mockRejectedValue(new Error('Fail'));
      const promise = retryWithBackoff(func, 3, 100);

      // Avançar tempo suficiente para todas as tentativas
      for (let i = 0; i < 10; i++) {
        jest.advanceTimersByTime(100);
        await Promise.resolve();
      }

      await expect(promise).rejects.toThrow('Fail');
      expect(func).toHaveBeenCalledTimes(3);
    });
  });

  describe('object/array utils', () => {
    it('deepClone deve clonar objetos profundamente', () => {
      const original = { a: 1, b: { c: 2 }, d: [3, 4] };
      const clone = deepClone(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
      expect(clone.d).not.toBe(original.d);
    });

    it('chunk deve dividir array', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('unique deve remover duplicatas', () => {
      expect(unique([1, 2, 2, 3])).toEqual([1, 2, 3]);
      expect(unique([{ id: 1 }, { id: 1 }, { id: 2 }], 'id')).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('groupBy deve agrupar itens', () => {
      const items = [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }];
      expect(groupBy(items, 'type')).toEqual({
        a: [{ type: 'a', val: 1 }, { type: 'a', val: 3 }],
        b: [{ type: 'b', val: 2 }],
      });
    });

    it('sortBy deve ordenar itens', () => {
      const items = [{ val: 3 }, { val: 1 }, { val: 2 }];
      expect(sortBy(items, [{ key: 'val', order: 'asc' }])).toEqual([{ val: 1 }, { val: 2 }, { val: 3 }]);
    });
  });

  describe('misc', () => {
    it('generateId deve retornar string não vazia', () => {
      expect(generateId().length).toBeGreaterThan(0);
    });

    it('isEmpty deve verificar vazio corretamente', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
      expect(isEmpty('a')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('safeJsonParse deve parsear ou retornar fallback', () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
      expect(safeJsonParse('invalid', { fallback: true })).toEqual({ fallback: true });
    });

    it('memoize deve cachear resultados', () => {
      const func = jest.fn((x) => x * 2);
      const memoized = memoize(func);

      expect(memoized(2)).toBe(4);
      expect(memoized(2)).toBe(4);
      expect(func).toHaveBeenCalledTimes(1);

      expect(memoized(3)).toBe(6);
      expect(func).toHaveBeenCalledTimes(2);
    });
  });

  describe('math', () => {
    it('clamp deve limitar valor', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('lerp deve interpolar', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('mapRange deve mapear valores', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
    });
  });

  // ============================================================================
  // TIMELINE FUNCTIONS TESTS
  // ============================================================================

  describe('timeline/mapLogToTimelineEvent', () => {
    it('deve mapear rota_criada corretamente', () => {
      const log = {
        id: '123',
        evento: 'rota_criada',
        timestamp: '2025-01-15T10:00:00Z',
        detalhes: { total_paradas: 5 },
      };

      const result = mapLogToTimelineEvent(log);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('log-123');
      expect(result?.type).toBe('status_change');
      expect(result?.title).toBe('Rota Criada');
      expect(result?.description).toContain('5 parada(s)');
      expect(result?.colorKey).toBe('purple');
      expect(result?.icon).toBe('add-circle');
    });

    it('deve mapear motorista_iniciou_rota corretamente', () => {
      const log = {
        id: '456',
        evento: 'motorista_iniciou_rota',
        timestamp: '2025-01-15T10:30:00Z',
        detalhes: null,
      };

      const result = mapLogToTimelineEvent(log);

      expect(result?.title).toBe('Rota Iniciada');
      expect(result?.colorKey).toBe('info');
      expect(result?.icon).toBe('play-circle');
    });

    it('deve mapear sos_acionado como crítico', () => {
      const log = {
        id: '789',
        evento: 'sos_acionado',
        timestamp: '2025-01-15T11:00:00Z',
        detalhes: { motivo: 'Emergência' },
      };

      const result = mapLogToTimelineEvent(log);

      expect(result?.title).toBe('🚨 SOS Acionado');
      expect(result?.isCritical).toBe(true);
      expect(result?.colorKey).toBe('error');
    });

    it('deve retornar null para evento desconhecido', () => {
      const log = {
        id: 'xxx',
        evento: 'evento_invalido',
        timestamp: '2025-01-15T12:00:00Z',
        detalhes: null,
      };

      const result = mapLogToTimelineEvent(log);
      expect(result).toBeNull();
    });
  });

  describe('timeline/mapParadaToTimelineEvent', () => {
    it('deve mapear parada concluída corretamente', () => {
      const parada = {
        id: 'p1',
        ordem: 3,
        endereco: 'Rua Teste, 123',
        status: 'concluida' as const,
        concluida_em: '2025-01-15T14:00:00Z',
        foto_url: 'https://example.com/foto.jpg',
      };

      const result = mapParadaToTimelineEvent(parada);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('parada-p1');
      expect(result?.title).toBe('Parada #3 Concluída');
      expect(result?.colorKey).toBe('success');
      expect(result?.hasPhoto).toBe(true);
      expect(result?.photoUrl).toBe('https://example.com/foto.jpg');
    });

    it('deve mapear parada pulada corretamente', () => {
      const parada = {
        id: 'p2',
        ordem: 5,
        endereco: 'Av. Principal, 456',
        status: 'pulada' as const,
        concluida_em: '2025-01-15T15:00:00Z',
      };

      const result = mapParadaToTimelineEvent(parada);

      expect(result?.title).toBe('Parada #5 Pulada');
      expect(result?.colorKey).toBe('warning');
      expect(result?.icon).toBe('remove-circle');
    });

    it('deve ignorar checkpoints (is_checkpoint === false)', () => {
      const parada = {
        id: 'p3',
        ordem: 1,
        endereco: 'Checkpoint',
        status: 'concluida' as const,
        concluida_em: '2025-01-15T16:00:00Z',
        is_checkpoint: false,
      };

      const result = mapParadaToTimelineEvent(parada);
      expect(result).toBeNull();
    });

    it('deve retornar null para parada pendente', () => {
      const parada = {
        id: 'p4',
        ordem: 2,
        endereco: 'Rua Pendente',
        status: 'pendente' as const,
        concluida_em: null,
      };

      const result = mapParadaToTimelineEvent(parada);
      expect(result).toBeNull();
    });
  });

  describe('timeline/mapIncidenteToTimelineEvent', () => {
    it('deve mapear incidente corretamente', () => {
      const incidente = {
        id: 'i1',
        categoria: 'absent',
        descricao: 'Cliente não estava em casa',
        created_at: '2025-01-15T13:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.id).toBe('incidente-i1');
      expect(result.title).toBe(INCIDENTE_LABELS['absent']);
      expect(result.description).toBe('Cliente não estava em casa');
      expect(result.colorKey).toBe('error');
      expect(result.isCritical).toBe(false);
    });

    it('deve marcar incidente crítico corretamente', () => {
      const incidente = {
        id: 'i2',
        categoria: 'accident',
        descricao: 'Colisão leve',
        created_at: '2025-01-15T14:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.isCritical).toBe(true);
      expect(CRITICAL_INCIDENT_CATEGORIES).toContain('accident');
    });

    it('deve truncar descrição longa', () => {
      const longDescription = 'A'.repeat(100);
      const incidente = {
        id: 'i3',
        categoria: 'other',
        descricao: longDescription,
        created_at: '2025-01-15T15:00:00Z',
      };

      const result = mapIncidenteToTimelineEvent(incidente);

      expect(result.description.length).toBeLessThan(longDescription.length);
      expect(result.description).toContain('...');
      expect(result.fullDescription).toBe(longDescription);
    });
  });

  describe('timeline/formatRelativeTime', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar "agora" para menos de 1 minuto', () => {
      const timestamp = new Date('2025-01-15T11:59:30Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('agora');
    });

    it('deve retornar "há X min" para menos de 1 hora', () => {
      const timestamp = new Date('2025-01-15T11:45:00Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('há 15 min');
    });

    it('deve retornar "há Xh" para menos de 24 horas', () => {
      const timestamp = new Date('2025-01-15T09:00:00Z').toISOString();
      expect(formatRelativeTime(timestamp)).toBe('há 3h');
    });

    it('deve retornar "ontem HH:MM" para ontem', () => {
      // Definir horário de "agora" como meio-dia do dia 15
      // E timestamp de ontem às 10:00 (mais de 24h atrás, mas no dia anterior)
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
      const timestamp = new Date('2025-01-14T10:00:00Z').toISOString();
      const result = formatRelativeTime(timestamp);
      expect(result).toContain('ontem');
    });
  });

  describe('timeline/getDateGroup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve retornar "Hoje" para eventos de hoje', () => {
      const timestamp = new Date('2025-01-15T08:00:00Z').toISOString();
      expect(getDateGroup(timestamp)).toBe('Hoje');
    });

    it('deve retornar "Ontem" para eventos de ontem', () => {
      const timestamp = new Date('2025-01-14T14:00:00Z').toISOString();
      expect(getDateGroup(timestamp)).toBe('Ontem');
    });

    it('deve retornar data formatada para eventos antigos', () => {
      const timestamp = new Date('2025-01-10T10:00:00Z').toISOString();
      const result = getDateGroup(timestamp);
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });
  });

  describe('timeline/calculateDurationBetween', () => {
    it('deve calcular duração entre eventos', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T10:15:00Z';

      const result = calculateDurationBetween(start, end);

      expect(result).toContain('15');
      expect(result).toContain('min');
    });

    it('deve retornar null para duração menor que 1 minuto', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T10:00:30Z';

      const result = calculateDurationBetween(start, end);
      expect(result).toBeNull();
    });

    it('deve formatar horas corretamente', () => {
      const start = '2025-01-15T10:00:00Z';
      const end = '2025-01-15T12:30:00Z';

      const result = calculateDurationBetween(start, end);

      expect(result).toContain('2h');
      expect(result).toContain('30');
    });
  });
});
