/**
 * useHistoricoMetrics: o cabeçalho vem do resumo do período (RPC), não da
 * soma da lista baixada.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockBuscar = jest.fn();
jest.mock('@/lib/motorista/resumoDesempenho', () => ({
  buscarResumoDesempenho: (...a: unknown[]) => mockBuscar(...a),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('@/lib/dateUtils', () => ({
  ...jest.requireActual('@/lib/dateUtils'),
  getTodayISO: () => '2026-11-10',
}));

import { useHistoricoMetrics } from '../useHistoricoMetrics';

const resumo = (over: Record<string, unknown> = {}) => ({
  totalRotas: 0,
  rotasConcluidas: 0,
  rotasCanceladas: 0,
  distanciaTotal: 0,
  totalParadas: 0,
  paradasConcluidas: 0,
  paradasPuladas: 0,
  entregasEmRotasConcluidas: 0,
  tempoMedioMinutos: null,
  ...over,
});

const base = {
  habilitado: true,
  motoristaId: 'm1' as string | undefined,
  de: '2026-11-01' as string | null,
  ate: '2026-11-30' as string | null,
  ehEsteMes: true,
};

beforeEach(() => mockBuscar.mockReset());

it('usa os números do resumo, sem cortar o fim em hoje', async () => {
  mockBuscar.mockResolvedValue(
    resumo({
      totalRotas: 393,
      rotasConcluidas: 390,
      totalParadas: 1449,
      paradasConcluidas: 1273,
      distanciaTotal: 18241.94,
      tempoMedioMinutos: 41.6,
    }),
  );
  const { result } = renderHook(() => useHistoricoMetrics(base));
  await waitFor(() => expect(result.current.carregando).toBe(false));

  expect(mockBuscar).toHaveBeenCalledTimes(1);
  expect(mockBuscar).toHaveBeenCalledWith('m1', {
    intervalo: { de: '2026-11-01', ate: '2026-11-30' },
  });
  expect(result.current.metricas).toEqual({
    rotasTotais: 393,
    rotasConcluidas: 390,
    rotasMes: 393, // "Este mês": reusa o total do resumo
    paradasTotais: 1449,
    paradasConcluidas: 1273,
    distanciaTotal: 18241.9,
    tempoMedioMinutos: 42,
    taxaSucesso: 88,
  });
});

it('fora de "Este mês" o {n} este mês vem de uma consulta à parte', async () => {
  mockBuscar.mockImplementation(
    async (_id: string, o: { intervalo: { de: string } }) =>
      o.intervalo.de === '2026-11-01'
        ? resumo({ totalRotas: 7 })
        : resumo({ totalRotas: 20 }),
  );
  const { result } = renderHook(() =>
    useHistoricoMetrics({
      ...base,
      de: '2026-10-01',
      ate: '2026-10-31',
      ehEsteMes: false,
    }),
  );
  await waitFor(() => expect(result.current.carregando).toBe(false));

  expect(mockBuscar).toHaveBeenCalledTimes(2);
  expect(mockBuscar).toHaveBeenCalledWith('m1', {
    intervalo: { de: '2026-11-01', ate: '2026-11-30' },
  });
  expect(result.current.metricas?.rotasTotais).toBe(20);
  expect(result.current.metricas?.rotasMes).toBe(7);
});

it('sem paradas: taxa 0 e tempo médio 0 (sem dividir por zero)', async () => {
  mockBuscar.mockResolvedValue(resumo());
  const { result } = renderHook(() => useHistoricoMetrics(base));
  await waitFor(() => expect(result.current.carregando).toBe(false));
  expect(result.current.metricas).toMatchObject({
    taxaSucesso: 0,
    tempoMedioMinutos: 0,
  });
});

it('não consulta enquanto não estiver habilitado', async () => {
  const { result } = renderHook(() =>
    useHistoricoMetrics({ ...base, habilitado: false }),
  );
  expect(mockBuscar).not.toHaveBeenCalled();
  expect(result.current.carregando).toBe(true);
});

it('resposta velha chegando por último não sobrescreve a do período atual', async () => {
  let soltar: (v: unknown) => void = () => {};
  mockBuscar.mockReturnValueOnce(new Promise((r) => (soltar = r)));
  mockBuscar.mockResolvedValueOnce(resumo({ totalRotas: 5 }));
  const { result, rerender } = renderHook(
    (p: typeof base) => useHistoricoMetrics(p),
    { initialProps: base },
  );
  rerender({ ...base, de: '2026-10-01', ate: '2026-10-31' });
  await waitFor(() => expect(result.current.metricas?.rotasTotais).toBe(5));

  soltar(resumo({ totalRotas: 99 }));
  await Promise.resolve();
  await Promise.resolve();
  expect(result.current.metricas?.rotasTotais).toBe(5);
});

it('erro do resumo: sem números (nada zerado em silêncio) e marcado como indisponível', async () => {
  mockBuscar.mockRejectedValue(new Error('rede'));
  const { result } = renderHook(() => useHistoricoMetrics(base));
  await waitFor(() => expect(result.current.carregando).toBe(false));
  expect(result.current.metricas).toBeNull();
  expect(result.current.indisponivel).toBe(true);
});

it('trocar de período tira os números do anterior enquanto o novo carrega', async () => {
  mockBuscar.mockResolvedValueOnce(resumo({ totalRotas: 5 }));
  const { result, rerender } = renderHook(
    (p: typeof base) => useHistoricoMetrics(p),
    { initialProps: base },
  );
  await waitFor(() => expect(result.current.metricas?.rotasTotais).toBe(5));

  mockBuscar.mockReturnValueOnce(new Promise(() => {}));
  rerender({ ...base, de: '2026-10-01', ate: '2026-10-31' });
  await waitFor(() => expect(result.current.metricas).toBeNull());
  expect(result.current.indisponivel).toBe(false);
});

it('refresh que falha mantém os números que já estavam na tela', async () => {
  mockBuscar.mockResolvedValueOnce(resumo({ totalRotas: 5 }));
  const { result } = renderHook(() => useHistoricoMetrics(base));
  await waitFor(() => expect(result.current.metricas?.rotasTotais).toBe(5));

  mockBuscar.mockRejectedValue(new Error('rede'));
  act(() => result.current.recarregar());
  await waitFor(() => expect(result.current.carregando).toBe(false));
  expect(result.current.metricas?.rotasTotais).toBe(5);
  expect(result.current.indisponivel).toBe(false);
});
