/**
 * O marcador do motorista compara pelo `timestamp` do GPS, não pela ordem de
 * chegada: a fila offline reenvia posições antigas pelo realtime, e a carga
 * inicial pode chegar depois de um INSERT mais novo.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useMotoristaLocationMapLibre } from '../useMotoristaLocationMapLibre';

type Linha = { id: string; timestamp: string; latitude: number; longitude: number };

let mockResolverCarga: (valor: { data: Linha | null; error: null }) => void =
  () => {};
let mockAoInserir: ((payload: { new: Linha }) => void) | null = null;
const mockChannel = jest.fn();

jest.mock('@/lib/supabase', () => {
  const consulta: Record<string, unknown> = {};
  consulta.select = () => consulta;
  consulta.eq = () => consulta;
  consulta.order = () => consulta;
  consulta.limit = () => consulta;
  consulta.maybeSingle = () =>
    new Promise((resolve) => {
      mockResolverCarga = resolve;
    });
  return {
    supabase: {
      from: () => consulta,
      channel: (nome: string) => {
        mockChannel(nome);
        const canal = {
          on: (
            _evento: string,
            _filtro: unknown,
            cb: (payload: { new: Linha }) => void,
          ) => {
            mockAoInserir = cb;
            return canal;
          },
          subscribe: () => canal,
        };
        return canal;
      },
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

function linha(id: string, timestamp: string): Linha {
  return { id, timestamp, latitude: -7.1, longitude: -34.8 };
}

beforeEach(() => {
  mockAoInserir = null;
  mockChannel.mockClear();
});

it('posição antiga reenviada pela fila offline não volta o marcador', async () => {
  const { result } = renderHook(() => useMotoristaLocationMapLibre('rota-1'));
  await act(async () => {
    mockResolverCarga({ data: linha('atual', '2026-01-15T10:05:00Z'), error: null });
  });
  await waitFor(() => expect(result.current.location?.id).toBe('atual'));

  act(() => {
    mockAoInserir?.({ new: linha('da-fila', '2026-01-15T09:40:00Z') });
  });
  expect(result.current.location?.id).toBe('atual');

  act(() => {
    mockAoInserir?.({ new: linha('nova', '2026-01-15T10:06:00Z') });
  });
  expect(result.current.location?.id).toBe('nova');
});

it('carga inicial que chega depois de um INSERT mais novo não o sobrescreve', async () => {
  const { result } = renderHook(() => useMotoristaLocationMapLibre('rota-1'));

  act(() => {
    mockAoInserir?.({ new: linha('realtime', '2026-01-15T10:06:00Z') });
  });
  await act(async () => {
    mockResolverCarga({ data: linha('carga', '2026-01-15T10:05:00Z'), error: null });
  });

  expect(result.current.location?.id).toBe('realtime');
});

it('realtime: false não assina o canal (marcador estático)', async () => {
  renderHook(() =>
    useMotoristaLocationMapLibre('rota-1', { realtime: false }),
  );
  expect(mockChannel).not.toHaveBeenCalled();
});

it('trocar de rota não guarda a posição da rota anterior', async () => {
  const { result, rerender } = renderHook(
    ({ rota }: { rota: string }) => useMotoristaLocationMapLibre(rota),
    { initialProps: { rota: 'rota-1' } },
  );
  await act(async () => {
    mockResolverCarga({ data: linha('de-A', '2026-01-15T10:05:00Z'), error: null });
  });
  expect(result.current.location?.id).toBe('de-A');

  rerender({ rota: 'rota-2' });
  // Até a carga de B chegar, nada de A responde por B.
  expect(result.current.location).toBeNull();

  // O último ponto de B é MAIS ANTIGO que o de A (outro motorista, sem sinal).
  await act(async () => {
    mockResolverCarga({ data: linha('de-B', '2026-01-15T09:00:00Z'), error: null });
  });
  expect(result.current.location?.id).toBe('de-B');
});
