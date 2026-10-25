/**
 * Gestão de Rotas numa loja com mais de 100 rotas (item 4 do Review Focus).
 *
 * Antes: `.limit(100)` sem aviso. A lista parava na 100ª rota, a busca e o
 * filtro só olhavam essas 100 e a exportação saía com 100 linhas. Aqui o
 * hook real conversa com o `PostgrestClient` de verdade, contra um PostgREST
 * falso que aplica os filtros e o corte de 1.000 linhas do Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';

import { useGestaoRotas } from '../useGestaoRotas';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));
// Teto mutável (o real está documentado no módulo): o hook lê a constante
// no momento da exportação, então o teste do aviso baixa o teto para 150.
jest.mock('@/lib/gestor/consultaRotas', () => ({
  ...jest.requireActual('@/lib/gestor/consultaRotas'),
}));
const consultaMockada = () =>
  jest.requireMock('@/lib/gestor/consultaRotas') as {
    TETO_EXPORTACAO_ROTAS: number;
  };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'u1' }),
}));
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', nome: 'Gestor' } }),
}));
jest.mock('../useRealtimeRoutes', () => ({ useRealtimeRoutes: jest.fn() }));
jest.mock('../useDebounce', () => ({ useDebounce: (v: unknown) => v }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/docs/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/utils/errorHandling', () => ({
  showError: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

const mockShowToast = jest.fn();
const opcoes = {
  statusColorMap: {} as never,
  defaultStatusColor: 'x',
  showToast: mockShowToast,
  withToast: (async (fn: () => Promise<unknown>) => fn()) as never,
};

/** `n` rotas, duas por dia a partir de 2024-01-01; motoristas alternados. */
function rotas(n: number): LinhaFalsa[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${String(i).padStart(5, '0')}`,
    unidade_id: 'u1',
    data: new Date(Date.UTC(2024, 0, 1 + Math.floor(i / 2)))
      .toISOString()
      .slice(0, 10),
    status: i % 3 === 0 ? 'concluida' : 'pendente',
    distancia_total: 1,
    iniciada_em: null,
    concluida_em: null,
    motorista_id: i % 2 ? 'm-bruno' : 'm-ana',
    usuarios:
      i % 2 ? { id: 'm-bruno', nome: 'Bruno' } : { id: 'm-ana', nome: 'Ana' },
  }));
}

function montar(n: number) {
  const falso = criarPostgrestFalso({ rotas: rotas(n), paradas: [] });
  mockCliente = falso.cliente;
  return falso;
}

/** Linhas de dados do CSV gravado (sem BOM e sem cabeçalho). */
function linhasDoCSV(): string[] {
  const chamadas = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
  const conteudo = chamadas[chamadas.length - 1][1] as string;
  return conteudo.split('\n').slice(1);
}

beforeEach(() => {
  jest.clearAllMocks();
  consultaMockada().TETO_EXPORTACAO_ROTAS = 10_000;
  Platform.OS = 'android';
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('useGestaoRotas — mais de 100 rotas', () => {
  it('carrega 100, diz o total da loja e "carregar mais" traz as seguintes', async () => {
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));

    await waitFor(() => expect(result.current.total).toBe(437));
    expect(result.current.rotas).toHaveLength(100);
    expect(result.current.temMais).toBe(true);
    expect(result.current.contagens).toEqual({
      concluidas: 146,
      pendentes: 291,
    });

    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await result.current.carregarMais();
      });
    }

    expect(result.current.rotas).toHaveLength(437);
    expect(new Set(result.current.rotas.map((r) => r.id)).size).toBe(437);
    expect(result.current.temMais).toBe(false);
  });

  it('recarregar (realtime, "tentar de novo") mantém as páginas já abertas', async () => {
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    await act(async () => {
      await result.current.carregarMais();
    });
    await act(async () => {
      await result.current.loadRotas();
    });

    expect(result.current.rotas).toHaveLength(200);
  });

  it('"carregar mais" tocado com carga em voo é ignorado: não soma páginas nem reinicia a carga', async () => {
    const falso = montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));
    const antes = falso.requisicoes.length;

    await act(async () => {
      const carga = result.current.loadRotas();
      // Três toques impacientes enquanto a recarga não volta.
      await Promise.all([
        result.current.carregarMais(),
        result.current.carregarMais(),
        result.current.carregarMais(),
        carga,
      ]);
    });

    expect(result.current.rotas).toHaveLength(100);
    // Só a recarga pediu rotas (+ a contagem por status dela).
    const pedidosDeRotas = falso.requisicoes
      .slice(antes)
      .filter((r) => r.tabela === 'rotas' && r.metodo === 'GET');
    expect(pedidosDeRotas).toHaveLength(1);

    // Terminada a carga, o toque volta a valer.
    await act(async () => {
      await result.current.carregarMais();
    });
    expect(result.current.rotas).toHaveLength(200);
  });

  it('busca vai ao servidor: acha rota que não estava entre as 100 carregadas', async () => {
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    act(() => result.current.setSearchQuery('01/01/2024'));

    await waitFor(() =>
      expect(result.current.rotasFiltradas.map((r) => r.id).sort()).toEqual([
        'r00000',
        'r00001',
      ]),
    );
    expect(result.current.total).toBe(2);
  });

  it('filtro de status vai ao servidor e volta à primeira página', async () => {
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));
    await act(async () => {
      await result.current.carregarMais();
    });

    act(() => result.current.setFiltroStatus('concluida'));

    await waitFor(() => expect(result.current.total).toBe(146));
    expect(result.current.rotas).toHaveLength(100);
    expect(result.current.rotas.every((r) => r.status === 'concluida')).toBe(
      true,
    );
  });

  it('exporta TODAS as rotas do filtro, além do corte de 1.000, com progresso', async () => {
    montar(2345);
    // Cada render registra o progresso exposto: nenhum estado intermediário
    // escapa por amostragem.
    const progresso: unknown[] = [];
    const { result } = renderHook(() => {
      const r = useGestaoRotas(opcoes);
      if (r.exportacao) progresso.push(r.exportacao);
      return r;
    });
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    // Fora de um `act` assíncrono único (que juntaria todos os estados num
    // render só): cada página é um render.
    let exportacao: Promise<void> = Promise.resolve();
    act(() => {
      exportacao = result.current.exportarParaCSV();
    });
    await waitFor(() => expect(result.current.exportacao).toBeNull());
    await act(() => exportacao);

    expect(linhasDoCSV()).toHaveLength(2345);
    expect(progresso).toEqual(
      expect.arrayContaining([
        { formato: 'csv', carregadas: 0, total: null },
        { formato: 'csv', carregadas: 1000, total: 2345 },
        { formato: 'csv', carregadas: 2000, total: 2345 },
        // O passo final (2345) sai no mesmo render que o fim da exportação.
      ]),
    );
    expect(result.current.exportacao).toBeNull();
    expect(mockShowToast).not.toHaveBeenCalledWith(
      expect.anything(),
      'error',
      expect.anything(),
    );
  });

  it('exportação respeita a busca e a ordenação escolhida', async () => {
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    act(() => {
      result.current.setSearchQuery('bruno');
      result.current.handleSort('data', 'asc');
    });
    await waitFor(() => expect(result.current.total).toBe(218));

    await act(async () => {
      await result.current.exportarParaCSV();
    });

    const linhas = linhasDoCSV();
    expect(linhas).toHaveLength(218);
    expect(linhas.every((l) => l.includes('"Bruno"'))).toBe(true);
    expect(linhas[0].startsWith('"01/01/2024"')).toBe(true);
  });

  it('acima do teto exporta as mais recentes e avisa quantas ficaram de fora', async () => {
    consultaMockada().TETO_EXPORTACAO_ROTAS = 150;
    montar(437);
    const { result } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    await act(async () => {
      await result.current.exportarParaXLSX();
    });

    const XLSX = jest.requireMock('xlsx');
    const planilha = XLSX.utils.aoa_to_sheet.mock.calls[0][0] as unknown[][];
    expect(planilha).toHaveLength(151); // cabeçalho + 150
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('150 rotas mais recentes de 437'),
      'info',
      expect.any(Number),
    );
  });

  it('sair da tela no meio da exportação cancela: nada é gravado', async () => {
    montar(2345);
    const { result, unmount } = renderHook(() => useGestaoRotas(opcoes));
    await waitFor(() => expect(result.current.rotas).toHaveLength(100));

    let exportacao: Promise<void>;
    act(() => {
      exportacao = result.current.exportarParaCSV();
    });
    unmount();
    await exportacao!;

    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => 'BASE64'),
}));
