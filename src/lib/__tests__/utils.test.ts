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
});
