/**
 * Incidentes do gestor por período: a lista e as contagens respeitam o
 * `created_at` do período lembrado, e os pendentes (aberto/em análise) de
 * antes dele viram um número para o aviso, com o "Ver" que abre tudo.
 *
 * O hook real fala com o `PostgrestClient` de verdade, contra o PostgREST
 * falso. Instantes dependem do fuso: casos dependentes só rodam em
 * America/Sao_Paulo (o CI roda assim).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';
import { chavePeriodo } from '@/hooks/usePeriodoLembrado';
import { defaultTheme } from '@/utils/styles.base';

import { useIncidentesGestor } from '../useIncidentesGestor';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));
jest.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'g1', unidades: { nome: 'Loja A' } },
    loading: false,
  }),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const noSP = new Date(2026, 10, 10).getTimezoneOffset() === 180;

function inc(
  id: string,
  created_at: string,
  status: string,
  categoria = 'other',
  unidade_id = 'loja-a',
): LinhaFalsa {
  return {
    id,
    unidade_id,
    categoria,
    descricao: id,
    endereco: 'Rua A',
    status,
    foto_url: null,
    created_at,
    observacoes_gestao: null,
    motorista_id: 'm1',
    motorista: { nome: 'M1' },
    rota: null,
    parada: null,
  };
}

const armazem = new Map<string, string>();

function periodoLembrado(valor: object | null) {
  armazem.clear();
  if (valor)
    armazem.set(chavePeriodo('incidentes', 'g1'), JSON.stringify(valor));
}

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => armazem.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      armazem.set(k, v);
    },
  );
});

const renderizar = () =>
  renderHook(() =>
    useIncidentesGestor(defaultTheme as never, { showToast: jest.fn() }),
  );

const NOVEMBRO = { tipo: 'personalizado', de: '2026-11-01', ate: '2026-11-30' };

describe('useIncidentesGestor — período', () => {
  (noSP ? it : it.skip)(
    'a lista mostra só novembro (limites em instantes locais)',
    async () => {
      mockCliente = criarPostgrestFalso({
        incidentes: [
          inc('antes', '2026-11-01T02:59:59.000Z', 'resolvido'),
          inc('primeiro', '2026-11-01T03:00:00.000Z', 'aberto'),
          inc('ultimo', '2026-12-01T02:59:59.000Z', 'aberto'),
          inc('depois', '2026-12-01T03:00:00.000Z', 'aberto'),
          inc(
            'outra-loja',
            '2026-11-10T12:00:00.000Z',
            'aberto',
            'other',
            'loja-b',
          ),
        ],
      }).cliente;
      periodoLembrado(NOVEMBRO);
      const { result } = renderizar();

      await waitFor(() => expect(result.current.total).toBe(2));
      expect(result.current.incidentes.map((i) => i.id)).toEqual([
        'ultimo',
        'primeiro',
      ]);
    },
  );

  it('conta os pendentes de antes do período, só aberto e em análise', async () => {
    mockCliente = criarPostgrestFalso({
      incidentes: [
        inc('a', '2026-10-05T12:00:00.000Z', 'aberto'),
        inc('b', '2026-09-05T12:00:00.000Z', 'em_analise'),
        inc('c', '2026-10-06T12:00:00.000Z', 'resolvido'),
        inc('d', '2026-10-07T12:00:00.000Z', 'fechado'),
        inc('e', '2026-10-08T12:00:00.000Z', 'aberto', 'other', 'loja-b'),
        inc('f', '2026-11-10T12:00:00.000Z', 'aberto'),
      ],
    }).cliente;
    periodoLembrado(NOVEMBRO);
    const { result } = renderizar();

    await waitFor(() => expect(result.current.total).toBe(1));
    expect(result.current.pendentesAntesDoPeriodo).toBe(2);
  });

  it('o aviso respeita a categoria escolhida', async () => {
    mockCliente = criarPostgrestFalso({
      incidentes: [
        inc('a', '2026-10-05T12:00:00.000Z', 'aberto', 'accident'),
        inc('b', '2026-10-06T12:00:00.000Z', 'aberto', 'absent'),
      ],
    }).cliente;
    periodoLembrado(NOVEMBRO);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.pendentesAntesDoPeriodo).toBe(2));

    act(() => result.current.setFiltroCategoria('accident'));
    await waitFor(() => expect(result.current.pendentesAntesDoPeriodo).toBe(1));
  });

  it('em "Todo o período" não há aviso', async () => {
    mockCliente = criarPostgrestFalso({
      incidentes: [inc('a', '2026-10-05T12:00:00.000Z', 'aberto')],
    }).cliente;
    periodoLembrado({ tipo: 'todo' });
    const { result } = renderizar();

    await waitFor(() => expect(result.current.total).toBe(1));
    expect(result.current.pendentesAntesDoPeriodo).toBe(0);
  });

  it('"Ver" abre todo o período só com aberto e em análise', async () => {
    mockCliente = criarPostgrestFalso({
      incidentes: [
        inc('a', '2026-10-05T12:00:00.000Z', 'aberto'),
        inc('b', '2026-10-06T12:00:00.000Z', 'resolvido'),
        inc('c', '2026-11-10T12:00:00.000Z', 'em_analise'),
        inc('d', '2026-11-11T12:00:00.000Z', 'fechado'),
      ],
    }).cliente;
    periodoLembrado(NOVEMBRO);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.pendentesAntesDoPeriodo).toBe(1));

    act(() => result.current.verPendentesAnteriores());

    // Novembro já tinha 2 (c, d): espera a lista trocada, não o número.
    await waitFor(() =>
      expect(result.current.incidentes.map((i) => i.id).sort()).toEqual([
        'a',
        'c',
      ]),
    );
    expect(result.current.periodo).toEqual({ tipo: 'todo' });
    expect(result.current.filtroStatus).toBe('pendentes');
    expect(result.current.pendentesAntesDoPeriodo).toBe(0);
  });

  it('trocar o período refaz a consulta uma vez', async () => {
    mockCliente = criarPostgrestFalso({
      incidentes: [
        inc('a', '2026-10-05T12:00:00.000Z', 'aberto'),
        inc('b', '2026-11-05T12:00:00.000Z', 'aberto'),
      ],
    }).cliente;
    periodoLembrado(NOVEMBRO);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.total).toBe(1));

    act(() => result.current.definirPeriodo({ tipo: 'todo' }));
    await waitFor(() => expect(result.current.total).toBe(2));
  });
});
