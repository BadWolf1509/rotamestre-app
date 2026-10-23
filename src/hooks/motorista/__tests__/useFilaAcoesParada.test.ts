import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  _resetFilaAcoesParada,
  criarAcaoParada,
  enfileirarAcaoParada,
  processarFilaAcoesParada,
  type PortaParadas,
} from '@/lib/motorista/filaAcoesParada';

import { useFilaAcoesParada } from '../useFilaAcoesParada';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mapa.delete(k);
    }),
  };
});
jest.mock('@/lib/supabase');

const acao = (paradaId: string, motoristaId = 'mot-1') =>
  criarAcaoParada({
    tipo: 'concluir',
    paradaId,
    rotaId: 'rota-1',
    motoristaId,
    em: '2026-10-23T12:00:00.000Z',
  });

const portaQueRemove: PortaParadas = {
  lerParada: async () => null,
  atualizarSeAberta: async () => false,
  avancarProxima: async () => undefined,
};

beforeEach(() => {
  (AsyncStorage as unknown as { __mapa: Map<string, string> }).__mapa.clear();
  _resetFilaAcoesParada();
});

describe('useFilaAcoesParada', () => {
  it('lista as ações do motorista e acompanha a fila quando ela muda', async () => {
    await enfileirarAcaoParada(acao('p1'));
    await enfileirarAcaoParada(acao('p9', 'outra-conta'));
    const { result } = renderHook(() => useFilaAcoesParada('mot-1'));

    await waitFor(() => expect(result.current.acoes).toHaveLength(1));
    expect(result.current.acoes[0].paradaId).toBe('p1');

    await act(async () => {
      await enfileirarAcaoParada(acao('p2'));
    });
    await waitFor(() => expect(result.current.acoes).toHaveLength(2));
  });

  it('mostra o aviso de ação descartada e permite dispensar', async () => {
    await enfileirarAcaoParada(acao('p1'));
    const { result } = renderHook(() => useFilaAcoesParada('mot-1'));
    await waitFor(() => expect(result.current.acoes).toHaveLength(1));

    await act(async () => {
      await processarFilaAcoesParada({
        usuarioAtual: 'mot-1',
        porta: portaQueRemove,
      });
    });

    await waitFor(() => expect(result.current.descartes).toHaveLength(1));
    expect(result.current.acoes).toHaveLength(0);

    await act(async () => {
      await result.current.dispensarDescartes();
    });
    await waitFor(() => expect(result.current.descartes).toHaveLength(0));
  });
});
