/**
 * Troca de loja em Incidentes do gestor (GES-7).
 *
 * Antes, a lista e as contagens da loja anterior ficavam na tela até a carga
 * nova chegar; se ela falhasse, só um toast aparecia sobre os incidentes da
 * OUTRA loja.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { tabelasFalsas } from '@/__tests__/helpers/consultaFalsa';
import { defaultTheme } from '@/utils/styles.base';

import { useIncidentesGestor } from '../useIncidentesGestor';

let mockLoja: string | null = 'loja-a';
let mockLojaComErro: string | null = null;
let mockSegurada: { promessa: Promise<void>; liberar: () => void } | null =
  null;

jest.mock('@/lib/supabase', () => {
  const base = require('@/__tests__/helpers/consultaFalsa').moduloConsultaFalsa;
  return {
    ...base,
    supabase: {
      ...base.supabase,
      from: (tabela: string) => {
        const api = base.supabase.from(tabela);
        const originalThen = api.then.bind(api);
        // Segura/derruba a consulta de incidentes da loja B nos testes.
        api.then = (
          resolve: (v: unknown) => void,
          reject: (e: unknown) => void,
        ) =>
          Promise.resolve(mockSegurada?.promessa).then(() =>
            mockLojaComErro
              ? resolve({ data: null, count: null, error: { message: 'rede' } })
              : originalThen(resolve, reject),
          );
        return api;
      },
    },
  };
});
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', unidades: { nome: 'Loja' } } }),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: mockLoja, loading: false }),
}));
const mockToast = {
  toast: { visible: false, message: '', type: 'success' },
  showToast: jest.fn(),
  hideToast: jest.fn(),
};
jest.mock('../useToast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

function incidente(id: string, loja: string, created_at: string) {
  return {
    id,
    categoria: 'outro',
    descricao: id,
    endereco: null,
    status: 'aberto',
    foto_url: null,
    created_at,
    observacoes_gestao: null,
    motorista_id: 'ana',
    unidade_id: loja,
    rota_id: null,
    motorista: { nome: 'Ana' },
    rota: null,
    parada: null,
  };
}

function montar() {
  return renderHook(() =>
    useIncidentesGestor(defaultTheme as never, {
      showToast: mockToast.showToast,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLoja = 'loja-a';
  mockLojaComErro = null;
  mockSegurada = null;
  tabelasFalsas.incidentes = [
    incidente('a1', 'loja-a', '2026-10-20T10:00:00Z'),
    incidente('a2', 'loja-a', '2026-10-21T10:00:00Z'),
    incidente('b1', 'loja-b', '2026-10-22T10:00:00Z'),
  ];
});

describe('useIncidentesGestor — troca de loja', () => {
  it('não mostra os incidentes da loja anterior enquanto a nova carrega', async () => {
    const { result, rerender } = montar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(2));

    let liberar: () => void = () => {};
    mockSegurada = {
      promessa: new Promise<void>((r) => {
        liberar = r;
      }),
      liberar: () => liberar(),
    };
    mockLoja = 'loja-b';
    rerender({});

    expect(result.current.incidentes).toEqual([]);
    expect(result.current.total).toBeNull();
    expect(result.current.resumoGeral.total).toBe(0);
    expect(result.current.loading).toBe(true);

    await act(async () => {
      mockSegurada?.liberar();
    });
    await waitFor(() =>
      expect(result.current.incidentes.map((i) => i.id)).toEqual(['b1']),
    );
    expect(result.current.loading).toBe(false);
  });

  it('carga da loja nova falhando deixa a lista vazia, sem os da anterior', async () => {
    const { result, rerender } = montar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(2));

    mockLojaComErro = 'loja-b';
    mockLoja = 'loja-b';
    rerender({});

    await waitFor(() =>
      expect(mockToast.showToast).toHaveBeenCalledWith(
        'Erro ao carregar incidentes',
        'error',
      ),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.incidentes).toEqual([]);
    expect(result.current.total).toBeNull();
  });

  it('loja A → sem loja → loja B: lista, total e contagens de A somem no "sem loja"', async () => {
    const { result, rerender } = montar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(2));
    expect(result.current.resumoGeral.total).toBe(2);

    mockLoja = null;
    rerender({});

    await waitFor(() => expect(result.current.incidentes).toEqual([]));
    expect(result.current.total).toBeNull();
    expect(result.current.resumoGeral.total).toBe(0);
    expect(result.current.loading).toBe(false);

    mockLojaComErro = 'loja-b';
    mockLoja = 'loja-b';
    rerender({});
    expect(result.current.incidentes).toEqual([]);
    await waitFor(() =>
      expect(mockToast.showToast).toHaveBeenCalledWith(
        'Erro ao carregar incidentes',
        'error',
      ),
    );
    expect(result.current.incidentes).toEqual([]);
    expect(result.current.total).toBeNull();
  });
});
