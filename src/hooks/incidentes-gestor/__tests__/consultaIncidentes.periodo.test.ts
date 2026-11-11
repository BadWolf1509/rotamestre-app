/**
 * Período na consulta dos incidentes: `created_at >= desde` e
 * `created_at < antesDe`, em instantes de `limitesEmInstante`, e a contagem
 * dos pendentes de antes do período (HEAD, aberto ou em análise).
 *
 * Os instantes dependem do fuso: o CI roda com TZ=America/Sao_Paulo e os
 * casos dependentes se pulam fora dele (ver `periodo.test.ts`).
 */
import {
  buscarIncidentes,
  contarIncidentesPorStatus,
  contarPendentesAntesDoPeriodo,
  type FiltrosIncidentes,
} from '../consultaIncidentes';

type Chamada = [string, ...unknown[]];
let chamadas: Chamada[];
let respostaContagem: { count: number | null; error: unknown };

/** Construtor encadeável que só registra as chamadas e é "thenable". */
function mockConstrutor(): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_, nome: string) {
        if (nome === 'then') {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: [], error: null, ...respostaContagem });
        }
        return (...args: unknown[]) => {
          chamadas.push([nome, ...args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => mockConstrutor() },
}));

const noSP = new Date(2026, 10, 10).getTimezoneOffset() === 180;

const novembro: FiltrosIncidentes = {
  unidadeId: 'loja-a',
  status: 'todos',
  categoria: 'todos',
  periodo: { de: '2026-11-01', ate: '2026-11-30' },
};

beforeEach(() => {
  chamadas = [];
  respostaContagem = { count: 0, error: null };
});

const chamou = (nome: string, ...args: unknown[]) =>
  chamadas.some(
    (c) =>
      c[0] === nome &&
      args.every((a, i) => JSON.stringify(c[i + 1]) === JSON.stringify(a)),
  );

describe('período na consulta de incidentes', () => {
  (noSP ? it : it.skip)(
    'novembro vira created_at >= 01/11 03:00Z e < 01/12 03:00Z',
    async () => {
      await buscarIncidentes({ filtros: novembro, quantidade: 50 });
      expect(chamou('gte', 'created_at', '2026-11-01T03:00:00.000Z')).toBe(
        true,
      );
      expect(chamou('lt', 'created_at', '2026-12-01T03:00:00.000Z')).toBe(true);
    },
  );

  it('"Todo o período" não filtra por created_at', async () => {
    await buscarIncidentes({
      filtros: { ...novembro, periodo: { de: null, ate: null } },
      quantidade: 50,
    });
    expect(chamadas.some((c) => c[0] === 'gte' || c[0] === 'lt')).toBe(false);
  });

  it('só aplica o lado que existe', async () => {
    await buscarIncidentes({
      filtros: { ...novembro, periodo: { de: '2026-11-01', ate: null } },
      quantidade: 50,
    });
    expect(chamadas.some((c) => c[0] === 'gte')).toBe(true);
    expect(chamadas.some((c) => c[0] === 'lt')).toBe(false);
  });

  (noSP ? it : it.skip)(
    'as contagens por status usam o mesmo período',
    async () => {
      await contarIncidentesPorStatus(novembro);
      expect(chamou('gte', 'created_at', '2026-11-01T03:00:00.000Z')).toBe(
        true,
      );
      expect(chamou('lt', 'created_at', '2026-12-01T03:00:00.000Z')).toBe(true);
    },
  );

  it('o filtro "pendentes" vai ao servidor como in(aberto, em_analise)', async () => {
    await buscarIncidentes({
      filtros: { ...novembro, status: 'pendentes' },
      quantidade: 50,
    });
    expect(chamou('in', 'status', ['aberto', 'em_analise'])).toBe(true);
  });

  it('com "pendentes", só aberto e em análise são contados', async () => {
    respostaContagem = { count: 3, error: null };
    const r = await contarIncidentesPorStatus({
      ...novembro,
      status: 'pendentes',
    });
    expect(r).toEqual({ aberto: 3, em_analise: 3, resolvido: 0, fechado: 0 });
  });
});

describe('contarPendentesAntesDoPeriodo', () => {
  (noSP ? it : it.skip)(
    'conta aberto e em análise criados antes da meia-noite local do início',
    async () => {
      respostaContagem = { count: 4, error: null };
      const n = await contarPendentesAntesDoPeriodo(
        'loja-a',
        null,
        '2026-11-01',
      );
      expect(n).toBe(4);
      expect(chamou('eq', 'unidade_id', 'loja-a')).toBe(true);
      expect(chamou('in', 'status', ['aberto', 'em_analise'])).toBe(true);
      expect(chamou('lt', 'created_at', '2026-11-01T03:00:00.000Z')).toBe(true);
      expect(chamadas.some((c) => c[0] === 'eq' && c[1] === 'categoria')).toBe(
        false,
      );
    },
  );

  it('respeita a categoria quando há uma', async () => {
    await contarPendentesAntesDoPeriodo('loja-a', 'accident', '2026-11-01');
    expect(chamou('eq', 'categoria', 'accident')).toBe(true);
  });

  it('count nulo vira 0 e erro é lançado', async () => {
    respostaContagem = { count: null, error: null };
    expect(
      await contarPendentesAntesDoPeriodo('loja-a', null, '2026-11-01'),
    ).toBe(0);
    respostaContagem = { count: null, error: new Error('x') };
    await expect(
      contarPendentesAntesDoPeriodo('loja-a', null, '2026-11-01'),
    ).rejects.toThrow('x');
  });
});
