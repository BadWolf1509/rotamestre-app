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

describe('utils', () => {
  describe('formatBytes', () => {
    it('deve formatar 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('deve formatar bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('deve formatar kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('deve formatar megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB'); // 1024 * 1024
    });

    it('deve formatar gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB'); // 1024 * 1024 * 1024
    });

    it('deve respeitar parâmetro decimals', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB'); // 1.5 KB arredondado
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
    });

    it('deve lidar com decimals negativo usando 0', () => {
      expect(formatBytes(1536, -1)).toBe('2 KB');
    });
  });

  describe('formatDuration', () => {
    it('deve formatar milissegundos', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('deve formatar segundos', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(5500)).toBe('5.5s');
    });

    it('deve formatar minutos e segundos', () => {
      expect(formatDuration(60000)).toBe('1min 0s');
      expect(formatDuration(90000)).toBe('1min 30s');
      expect(formatDuration(125000)).toBe('2min 5s');
    });

    it('deve formatar horas e minutos', () => {
      expect(formatDuration(3600000)).toBe('1h 0min');
      expect(formatDuration(5400000)).toBe('1h 30min');
      expect(formatDuration(7200000)).toBe('2h 0min');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve adiar execução da função', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve cancelar chamadas anteriores', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve passar argumentos corretamente', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve executar função imediatamente na primeira chamada', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve ignorar chamadas durante período de throttle', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve permitir nova execução após período de throttle', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      jest.advanceTimersByTime(100);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('deepClone', () => {
    it('deve clonar valores primitivos', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('string')).toBe('string');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('deve clonar arrays', () => {
      const arr = [1, 2, 3];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
    });

    it('deve clonar arrays aninhados', () => {
      const arr = [1, [2, 3], [4, [5, 6]]];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      cloned[1][0] = 999;
      expect(arr[1][0]).toBe(2); // Original não foi modificado
    });

    it('deve clonar objetos', () => {
      const obj = { a: 1, b: 2 };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('deve clonar objetos aninhados', () => {
      const obj = { a: 1, b: { c: 2, d: { e: 3 } } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      cloned.b.c = 999;
      expect(obj.b.c).toBe(2); // Original não foi modificado
    });

    it('deve clonar Dates', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
      expect(cloned.getTime()).toBe(date.getTime());
    });
  });

  describe('generateId', () => {
    it('deve gerar ID não vazio', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('deve gerar IDs únicos', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('deve esperar tempo especificado', async () => {
      const promise = sleep(1000);
      let resolved = false;

      promise.then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      jest.advanceTimersByTime(1000);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('retryWithBackoff', () => {
    it('deve retornar sucesso na primeira tentativa', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('deve tentar novamente em caso de erro', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Erro 1'))
        .mockRejectedValueOnce(new Error('Erro 2'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('deve lançar erro após esgotar tentativas', async () => {
      const mockError = new Error('Falha persistente');
      const mockFn = jest.fn().mockRejectedValue(mockError);

      await expect(retryWithBackoff(mockFn, 3, 10)).rejects.toThrow('Falha persistente');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('chunk', () => {
    it('deve dividir array em chunks', () => {
      const arr = [1, 2, 3, 4, 5, 6];
      const chunks = chunk(arr, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    it('deve lidar com último chunk incompleto', () => {
      const arr = [1, 2, 3, 4, 5];
      const chunks = chunk(arr, 2);

      expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('deve retornar array vazio para entrada vazia', () => {
      expect(chunk([], 2)).toEqual([]);
    });
  });

  describe('unique', () => {
    it('deve remover primitivos duplicados', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('deve remover duplicados por chave de objeto', () => {
      const arr = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
      ];

      expect(unique(arr, 'id')).toEqual([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
    });

    it('deve retornar array vazio para entrada vazia', () => {
      expect(unique([])).toEqual([]);
    });
  });

  describe('groupBy', () => {
    it('deve agrupar itens por chave', () => {
      const arr = [
        { type: 'fruit', name: 'apple' },
        { type: 'vegetable', name: 'carrot' },
        { type: 'fruit', name: 'banana' },
      ];

      expect(groupBy(arr, 'type')).toEqual({
        fruit: [
          { type: 'fruit', name: 'apple' },
          { type: 'fruit', name: 'banana' },
        ],
        vegetable: [{ type: 'vegetable', name: 'carrot' }],
      });
    });

    it('deve retornar objeto vazio para array vazio', () => {
      expect(groupBy([], 'key' as any)).toEqual({});
    });
  });

  describe('sortBy', () => {
    it('deve ordenar por campo ascendente', () => {
      const arr = [{ age: 30 }, { age: 20 }, { age: 25 }];
      const sorted = sortBy(arr, [{ key: 'age', order: 'asc' }]);

      expect(sorted).toEqual([{ age: 20 }, { age: 25 }, { age: 30 }]);
    });

    it('deve ordenar por campo descendente', () => {
      const arr = [{ age: 20 }, { age: 30 }, { age: 25 }];
      const sorted = sortBy(arr, [{ key: 'age', order: 'desc' }]);

      expect(sorted).toEqual([{ age: 30 }, { age: 25 }, { age: 20 }]);
    });

    it('deve ordenar por múltiplos campos', () => {
      const arr = [
        { dept: 'A', age: 30 },
        { dept: 'B', age: 20 },
        { dept: 'A', age: 25 },
      ];

      const sorted = sortBy(arr, [
        { key: 'dept', order: 'asc' },
        { key: 'age', order: 'asc' },
      ]);

      expect(sorted).toEqual([
        { dept: 'A', age: 25 },
        { dept: 'A', age: 30 },
        { dept: 'B', age: 20 },
      ]);
    });
  });

  describe('memoize', () => {
    it('deve memoizar resultado da função', () => {
      const mockFn = jest.fn((x: number) => x * 2);
      const memoized = memoize(mockFn);

      expect(memoized(5)).toBe(10);
      expect(memoized(5)).toBe(10);
      expect(mockFn).toHaveBeenCalledTimes(1); // Cached
    });

    it('deve chamar função novamente para argumentos diferentes', () => {
      const mockFn = jest.fn((x: number) => x * 2);
      const memoized = memoize(mockFn);

      expect(memoized(5)).toBe(10);
      expect(memoized(10)).toBe(20);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('deve usar getKey customizado', () => {
      const mockFn = jest.fn((obj: { id: number }) => obj.id * 2);
      const memoized = memoize(mockFn, obj => `id-${obj.id}`);

      expect(memoized({ id: 5 })).toBe(10);
      expect(memoized({ id: 5 })).toBe(10); // Cached
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('isEmpty', () => {
    it('deve retornar true para null/undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    it('deve retornar true para string vazia', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('hello')).toBe(false);
    });

    it('deve retornar true para array vazio', () => {
      expect(isEmpty([])).toBe(true);
      expect(isEmpty([1, 2])).toBe(false);
    });

    it('deve retornar true para objeto vazio', () => {
      expect(isEmpty({})).toBe(true);
      expect(isEmpty({ a: 1 })).toBe(false);
    });

    it('deve retornar false para números', () => {
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(42)).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('deve parsear JSON válido', () => {
      const json = '{"name":"John","age":30}';
      const result = safeJsonParse(json, {});

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('deve retornar fallback para JSON inválido', () => {
      const invalidJson = '{invalid json}';
      const fallback = { default: true };

      expect(safeJsonParse(invalidJson, fallback)).toBe(fallback);
    });

    it('deve retornar fallback para string vazia', () => {
      expect(safeJsonParse('', { default: true })).toEqual({ default: true });
    });
  });

  describe('formatPercentage', () => {
    it('deve formatar percentual com 1 casa decimal (padrão)', () => {
      expect(formatPercentage(0.5)).toBe('50.0%');
      expect(formatPercentage(0.75)).toBe('75.0%');
    });

    it('deve formatar com casas decimais customizadas', () => {
      expect(formatPercentage(0.5, 0)).toBe('50%');
      expect(formatPercentage(0.5, 2)).toBe('50.00%');
    });

    it('deve lidar com valores pequenos', () => {
      expect(formatPercentage(0.001, 2)).toBe('0.10%');
    });
  });

  describe('clamp', () => {
    it('deve retornar valor quando dentro do range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('deve retornar min quando valor é menor', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('deve retornar max quando valor é maior', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('deve lidar com valores negativos', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
    });
  });

  describe('lerp', () => {
    it('deve interpolar no início (t=0)', () => {
      expect(lerp(0, 100, 0)).toBe(0);
    });

    it('deve interpolar no fim (t=1)', () => {
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it('deve interpolar no meio (t=0.5)', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('deve interpolar em ponto arbitrário', () => {
      expect(lerp(0, 100, 0.25)).toBe(25);
      expect(lerp(0, 100, 0.75)).toBe(75);
    });
  });

  describe('mapRange', () => {
    it('deve mapear valor do meio de um range para outro', () => {
      // 50 está no meio de 0-100, deve mapear para meio de 0-1000 = 500
      expect(mapRange(50, 0, 100, 0, 1000)).toBe(500);
    });

    it('deve mapear valor do início', () => {
      expect(mapRange(0, 0, 100, 0, 1000)).toBe(0);
    });

    it('deve mapear valor do fim', () => {
      expect(mapRange(100, 0, 100, 0, 1000)).toBe(1000);
    });

    it('deve mapear para range diferente', () => {
      // 5 está no meio de 0-10, deve mapear para meio de 20-40 = 30
      expect(mapRange(5, 0, 10, 20, 40)).toBe(30);
    });
  });
});
