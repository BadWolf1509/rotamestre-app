/**
 * Incidentes do gestor com limite e paginação.
 *
 * Antes: a consulta não tinha limite. Uma loja com mais de 1.000 incidentes
 * via só os 1.000 mais recentes (max-rows do Supabase, sem erro) e os cartões
 * de resumo contavam esse recorte como se fosse o total. Agora a lista vem
 * de 50 em 50 ("carregar mais"), com o total e as contagens por status da
 * loja inteira. O hook real conversa com o `PostgrestClient` de verdade,
 * contra um PostgREST falso que aplica os filtros e o corte de 1.000 linhas.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';
import { defaultTheme } from '@/utils/styles.base';

import { useIncidentesGestor } from '../useIncidentesGestor';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));
jest.mock('../useUser', () => ({
  useUser: () => ({ userData: { id: 'g1', unidades: { nome: 'Loja A' } } }),
}));
jest.mock('../useUnidadeAtiva', () => ({
  useUnidadeAtiva: () => ({ unidadeAtiva: 'loja-a', loading: false }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const STATUS = ['aberto', 'em_analise', 'resolvido', 'fechado'];

/** `n` incidentes da loja A (e 5 da loja B), um por minuto. */
function incidentes(n: number): LinhaFalsa[] {
  const daLoja = (loja: string, i: number) => ({
    id: `${loja}-${String(i).padStart(5, '0')}`,
    unidade_id: loja,
    categoria: i % 2 ? 'absent' : 'blocked',
    descricao: `inc ${i}`,
    endereco: 'Rua A',
    status: STATUS[i % 4],
    foto_url: null,
    created_at: `2026-10-${String(1 + Math.floor(i / 1440)).padStart(2, '0')}T${String(
      Math.floor((i % 1440) / 60),
    ).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00+00:00`,
    observacoes_gestao: null,
    motorista_id: `m${i % 3}`,
    motorista: { nome: `Motorista ${i % 3}` },
    rota: null,
    parada: null,
  });
  return [
    ...Array.from({ length: n }, (_, i) => daLoja('loja-a', i)),
    ...Array.from({ length: 5 }, (_, i) => daLoja('loja-b', i)),
  ];
}

function montar(n: number) {
  const falso = criarPostgrestFalso({ incidentes: incidentes(n) });
  mockCliente = falso.cliente;
  return falso;
}

const mockShowToast = jest.fn();

function renderizar() {
  return renderHook(() =>
    useIncidentesGestor(defaultTheme as never, { showToast: mockShowToast }),
  );
}

beforeEach(() => jest.clearAllMocks());

describe('useIncidentesGestor — limite e paginação', () => {
  it('carrega 50, diz o total da loja e "carregar mais" traz os seguintes', async () => {
    montar(130);
    const { result } = renderizar();

    await waitFor(() => expect(result.current.total).toBe(130));
    expect(result.current.incidentes).toHaveLength(50);
    expect(result.current.incidentes[0].id).toBe('loja-a-00129');
    expect(result.current.temMais).toBe(true);

    await act(async () => {
      await result.current.carregarMais();
    });
    await act(async () => {
      await result.current.carregarMais();
    });

    expect(result.current.incidentes).toHaveLength(130);
    expect(new Set(result.current.incidentes.map((i) => i.id)).size).toBe(130);
    expect(result.current.temMais).toBe(false);
  });

  it('incidentes no mesmo instante não repetem nem somem entre as páginas', async () => {
    const falso = criarPostgrestFalso({
      incidentes: incidentes(60).map((i) => ({
        ...i,
        created_at: '2026-10-24T10:00:00+00:00',
      })),
    });
    mockCliente = falso.cliente;
    const { result } = renderizar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(50));

    await act(async () => {
      await result.current.carregarMais();
    });

    expect(new Set(result.current.incidentes.map((i) => i.id)).size).toBe(60);
  });

  it('os cartões de resumo contam a loja inteira, não só os 50 carregados', async () => {
    montar(1203);
    const { result } = renderizar();

    await waitFor(() => expect(result.current.resumoGeral.total).toBe(1203));
    expect(result.current.incidentes).toHaveLength(50);
    expect(result.current.resumoGeral).toMatchObject({
      abertos: 301,
      emAnalise: 301,
      resolvidos: 301,
      fechados: 300,
    });
  });

  it('filtro de status vai ao servidor, conta só esse status e volta à primeira página', async () => {
    montar(300);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(50));
    await act(async () => {
      await result.current.carregarMais();
    });

    act(() => result.current.setFiltroStatus('resolvido'));

    await waitFor(() => expect(result.current.total).toBe(75));
    expect(result.current.incidentes).toHaveLength(50);
    expect(
      result.current.incidentes.every((i) => i.status === 'resolvido'),
    ).toBe(true);
    expect(result.current.resumoGeral).toMatchObject({
      total: 75,
      abertos: 0,
      resolvidos: 75,
    });
  });

  it('recarregar depois de alterar status mantém as páginas abertas', async () => {
    montar(130);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(50));
    await act(async () => {
      await result.current.carregarMais();
    });

    await act(async () => {
      await result.current.fetchIncidentes();
    });

    expect(result.current.incidentes).toHaveLength(100);
  });

  it('"carregar mais" tocado com carga em voo é ignorado: não pede página com cursor velho', async () => {
    const falso = montar(130);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(50));
    const antes = falso.requisicoes.length;

    await act(async () => {
      const carga = result.current.fetchIncidentes();
      // Toques impacientes enquanto a recarga (depois de alterar um status)
      // não volta.
      await Promise.all([
        result.current.carregarMais(),
        result.current.carregarMais(),
        carga,
      ]);
    });

    expect(result.current.incidentes).toHaveLength(50);
    const pedidos = falso.requisicoes
      .slice(antes)
      .filter((r) => r.tabela === 'incidentes' && r.metodo === 'GET');
    expect(pedidos).toHaveLength(1);

    // Terminada a carga, o toque volta a valer.
    await act(async () => {
      await result.current.carregarMais();
    });
    expect(result.current.incidentes).toHaveLength(100);
  });

  it('toque duplo em "carregar mais" soma uma página só', async () => {
    const falso = montar(130);
    const { result } = renderizar();
    await waitFor(() => expect(result.current.incidentes).toHaveLength(50));
    const antes = falso.requisicoes.length;

    await act(async () => {
      await Promise.all([
        result.current.carregarMais(),
        result.current.carregarMais(),
      ]);
    });

    expect(result.current.incidentes).toHaveLength(100);
    expect(
      falso.requisicoes
        .slice(antes)
        .filter((r) => r.tabela === 'incidentes' && r.metodo === 'GET'),
    ).toHaveLength(1);
  });

  it('erro na carga vai para o toast da página', async () => {
    const falso = montar(10);
    falso.falhas.incidentes = { message: 'falhou', code: '500' };

    renderizar();

    await waitFor(() =>
      expect(mockShowToast).toHaveBeenCalledWith(
        'Erro ao carregar incidentes',
        'error',
      ),
    );
  });
});
