/**
 * Incidentes do gestor filtrados pela LOJA GRAVADA NO INCIDENTE
 * (`incidentes.unidade_id`, Migration 43), não pelos motoristas da loja nem
 * pela rota. Motorista que atende duas lojas não leva para a loja A os
 * incidentes da loja B — nem os sem rota, que agora também têm loja.
 *
 * Banco falso que aplica os filtros de verdade (`consultaFalsa`).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { tabelasFalsas } from '@/__tests__/helpers/consultaFalsa';
import { defaultTheme } from '@/utils/styles.base';

import { useIncidentesGestor } from '../useIncidentesGestor';

jest.mock(
  '@/lib/supabase',
  () => require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa,
);
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', unidades: { nome: 'Loja A' } } }),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
// Funções estáveis entre renders, como no hook real (senão o fetch, que
// depende de showToast, rodaria em laço).
const mockToast = {
  toast: { visible: false, message: '', type: 'success' },
  showToast: jest.fn(),
  hideToast: jest.fn(),
};
jest.mock('../useToast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function incidente(
  id: string,
  motorista: string,
  unidade_id: string,
  rota: { id: string; data: string; unidade_id: string } | null,
  created_at: string,
) {
  return {
    id,
    categoria: 'outro',
    descricao: id,
    endereco: null,
    status: 'aberto',
    foto_url: null,
    created_at,
    observacoes_gestao: null,
    motorista_id: motorista,
    unidade_id,
    rota_id: rota?.id ?? null,
    motorista: { nome: motorista },
    rota,
    parada: null,
  };
}

beforeEach(() => {
  tabelasFalsas.usuario_unidades = [
    {
      usuario_id: 'ana',
      unidade_id: 'loja-a',
      papel: 'motorista',
      ativo: true,
    },
    {
      usuario_id: 'ana',
      unidade_id: 'loja-b',
      papel: 'motorista',
      ativo: true,
    },
  ];
  tabelasFalsas.incidentes = [
    incidente(
      'da-loja-a',
      'ana',
      'loja-a',
      { id: 'r1', data: '2026-10-20', unidade_id: 'loja-a' },
      '2026-10-20T10:00:00Z',
    ),
    incidente(
      'da-loja-b',
      'ana',
      'loja-b',
      { id: 'r2', data: '2026-10-21', unidade_id: 'loja-b' },
      '2026-10-21T10:00:00Z',
    ),
    // sem rota: a loja gravada decide — o vínculo da Ana com as duas
    // lojas não leva o da loja B para a loja A
    incidente('sem-rota-a', 'ana', 'loja-a', null, '2026-10-22T10:00:00Z'),
    incidente('sem-rota-b', 'ana', 'loja-b', null, '2026-10-23T10:00:00Z'),
  ];
});

describe('useIncidentesGestor — recorte pela loja', () => {
  it('mostra só os incidentes gravados nesta loja, com ou sem rota', async () => {
    const { result } = renderHook(() =>
      useIncidentesGestor(defaultTheme as never),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incidentes.map((i) => i.id)).toEqual([
      'sem-rota-a',
      'da-loja-a',
    ]);
  });

  it('o histórico do motorista também fica nesta loja (a Ana atende as duas)', async () => {
    const { result } = renderHook(() =>
      useIncidentesGestor(defaultTheme as never),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleVerHistoricoMotorista('ana', 'Ana');
    });

    expect(result.current.incidentesMotorista.map((i) => i.id)).toEqual([
      'sem-rota-a',
      'da-loja-a',
    ]);
  });

  it('incidente de motorista excluído (motorista_id NULL, Migration 56) continua na lista, como "Motorista removido"', async () => {
    tabelasFalsas.incidentes = [
      ...tabelasFalsas.incidentes,
      {
        ...incidente('anonimizado', 'x', 'loja-a', null, '2026-10-24T10:00:00Z'),
        motorista_id: null,
        motorista: null,
      },
    ];
    const { result } = renderHook(() =>
      useIncidentesGestor(defaultTheme as never),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const anon = result.current.incidentes.find((i) => i.id === 'anonimizado');
    expect(anon).toBeDefined();
    expect(anon?.motorista_nome).toBe('Motorista removido');
    expect(anon?.motorista_id).toBeNull();
    // e entra nos números do resumo
    expect(result.current.resumoGeral.total).toBe(3);
  });
});
