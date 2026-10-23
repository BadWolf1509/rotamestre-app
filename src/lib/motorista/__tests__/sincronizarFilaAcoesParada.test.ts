import { supabase } from '@/lib/supabase';

import {
  _resetFilaAcoesParada,
  criarAcaoParada,
  enfileirarAcaoParada,
  lerFilaAcoesParada,
  sincronizarFilaAcoesParada,
} from '../filaAcoesParada';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, from: jest.fn() },
}));

beforeEach(() => {
  jest.requireMock('@react-native-async-storage/async-storage').__mapa.clear();
  _resetFilaAcoesParada();
  jest.clearAllMocks();
});

it('fila vazia: nem consulta a sessão', async () => {
  await sincronizarFilaAcoesParada();
  expect(supabase.auth.getSession).not.toHaveBeenCalled();
});

it('sem sessão (token vencido offline): a ação espera, não vai ao banco', async () => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({
    data: { session: null },
  });
  await enfileirarAcaoParada(
    criarAcaoParada({
      tipo: 'concluir',
      paradaId: 'p1',
      rotaId: 'r1',
      motoristaId: 'mot-1',
      em: '2026-10-23T12:00:00.000Z',
    }),
  );

  const r = await sincronizarFilaAcoesParada();

  expect(r.enviadas).toBe(0);
  expect(supabase.from).not.toHaveBeenCalled();
  expect(await lerFilaAcoesParada()).toHaveLength(1);
});
