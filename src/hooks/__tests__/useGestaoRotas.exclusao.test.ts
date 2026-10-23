/**
 * Exclusão pela Gestão de Rotas — mesma porta do dashboard (`excluirRota`).
 *
 * A lista vem do caminho de dados simulados do hook (isSupabaseConfigured
 * false) e o DELETE/log vão ao banco falso em memória (`bancoFalsoRotas`),
 * que reproduz a FK de `logs.rota_id`. Antes desta correção o log
 * `rota_excluida` era inserido DEPOIS do DELETE com o id da rota apagada —
 * a FK recusava e o erro não era lido; e a trava de `em_andamento` usava o
 * status que a TELA tinha.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  bancoFalso,
  resetarBancoFalso,
} from '@/__tests__/helpers/bancoFalsoRotas';

import { useGestaoRotas } from '../useGestaoRotas';

jest.mock('@/lib/supabase', () => ({
  ...require('@/__tests__/helpers/bancoFalsoRotas').moduloSupabaseFalso,
  isSupabaseConfigured: false,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'unidade-1' }),
}));
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('../useRealtimeRoutes', () => ({ useRealtimeRoutes: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const opcoes = { statusColorMap: {} as never, defaultStatusColor: 'x' };
const plataformaOriginal = Platform.OS;

beforeEach(() => {
  Platform.OS = 'web';
  // Dados simulados do hook: rota-1 em_andamento, rota-2 concluida,
  // rota-3 pendente. No "servidor", rota-3 JÁ foi iniciada.
  resetarBancoFalso([
    {
      id: 'rota-1',
      status: 'em_andamento',
      data: '2026-10-22',
      motorista_id: 'mot-1',
    },
    {
      id: 'rota-2',
      status: 'concluida',
      data: '2026-10-21',
      motorista_id: 'mot-2',
    },
    {
      id: 'rota-3',
      status: 'em_andamento',
      data: '2026-10-22',
      motorista_id: null,
    },
  ]);
});

afterAll(() => {
  Platform.OS = plataformaOriginal;
});

async function montar() {
  const hook = renderHook(() => useGestaoRotas(opcoes));
  await waitFor(() => expect(hook.result.current.loading).toBe(false), {
    timeout: 3000,
  });
  return hook;
}

describe('useGestaoRotas — exclusão', () => {
  it('rota concluída: apaga e grava o log rota_excluida (antes a FK recusava o log)', async () => {
    const { result } = await montar();
    const concluida = result.current.rotas.find((r) => r.id === 'rota-2')!;

    act(() => result.current.excluirRota(concluida));
    await act(async () => {
      result.current.handleConfirmDelete();
    });

    await waitFor(() =>
      expect(bancoFalso.rotas.some((r) => r.id === 'rota-2')).toBe(false),
    );
    expect(bancoFalso.logs).toEqual([
      expect.objectContaining({
        evento: 'rota_excluida',
        usuario_id: 'g1',
        detalhes: expect.objectContaining({
          rota_id: 'rota-2',
          status_anterior: 'concluida',
        }),
      }),
    ]);
  });

  it('rota que a tela mostra pendente mas o servidor já iniciou: não apaga e explica', async () => {
    const { result } = await montar();
    const pendenteNaTela = result.current.rotas.find((r) => r.id === 'rota-3')!;
    expect(pendenteNaTela.status).toBe('pendente');

    act(() => result.current.excluirRota(pendenteNaTela));
    await act(async () => {
      result.current.handleConfirmDelete();
    });

    await waitFor(() =>
      expect(result.current.toastState.message).toMatch(/em andamento/),
    );
    expect(bancoFalso.rotas.some((r) => r.id === 'rota-3')).toBe(true);
    expect(bancoFalso.logs).toHaveLength(0);
  });
});
