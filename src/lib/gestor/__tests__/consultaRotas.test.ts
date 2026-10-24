/**
 * Consulta da Gestão de Rotas no servidor: paginação por cursor, busca e
 * filtro no PostgREST, e a busca de todas as páginas para a exportação.
 *
 * Antes: `.limit(100)` sem aviso — a busca, o filtro e a exportação viam só as
 * 100 rotas mais recentes. Os testes rodam o `PostgrestClient` DE VERDADE
 * contra um PostgREST falso que aplica os filtros da URL e o corte de 1.000
 * linhas (max-rows do Supabase).
 */
import {
  criarPostgrestFalso,
  type LinhaFalsa,
} from '@/__tests__/helpers/postgrestFalso';

import {
  buscarRotas,
  contarRotasPorStatus,
  escaparIlike,
  filtroDepoisDoCursor,
  interpretarBusca,
  TAMANHO_PAGINA_ROTAS,
  TETO_EXPORTACAO_ROTAS,
  type FiltrosRotas,
} from '../consultaRotas';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (t: string) => mockCliente.from(t) },
  isSupabaseConfigured: true,
}));

/** `n` rotas da unidade, uma por dia a partir de 2024-01-01, ids ordenáveis. */
function rotas(
  n: number,
  extra: (i: number) => Partial<LinhaFalsa> = () => ({}),
): LinhaFalsa[] {
  return Array.from({ length: n }, (_, i) => {
    const dia = new Date(Date.UTC(2024, 0, 1 + Math.floor(i / 2)));
    return {
      id: `r${String(i).padStart(5, '0')}`,
      unidade_id: 'u1',
      data: dia.toISOString().slice(0, 10),
      status: i % 3 === 0 ? 'concluida' : 'pendente',
      distancia_total: 1,
      iniciada_em: null,
      concluida_em: null,
      motorista_id: 'm1',
      usuarios: { id: 'm1', nome: 'Ana' },
      ...extra(i),
    };
  });
}

function montar(linhas: LinhaFalsa[], paradas: LinhaFalsa[] = []) {
  const falso = criarPostgrestFalso({ rotas: linhas, paradas });
  mockCliente = falso.cliente;
  return falso;
}

const filtros = (f: Partial<FiltrosRotas> = {}): FiltrosRotas => ({
  unidadeId: 'u1',
  status: 'todas',
  busca: '',
  ...f,
});

describe('interpretarBusca', () => {
  it('texto vira busca por nome do motorista, com curingas escapados', () => {
    expect(interpretarBusca('ana', 2026)).toEqual({
      tipo: 'nome',
      padrao: '%ana%',
    });
    expect(interpretarBusca('  ', 2026)).toEqual({ tipo: 'nenhuma' });
  });

  it('dd/mm/aaaa é a data exata; data inexistente não acha nada', () => {
    expect(interpretarBusca('5/3/2026', 2026)).toEqual({
      tipo: 'datas',
      datas: ['2026-03-05'],
    });
    expect(interpretarBusca('31/02/2026', 2026)).toEqual({
      tipo: 'impossivel',
    });
  });

  it('dd/mm é o dia em qualquer ano da janela; 29/02 só nos bissextos', () => {
    expect(interpretarBusca('02/01', 2026)).toEqual({
      tipo: 'datas',
      datas: ['2024-01-02', '2025-01-02', '2026-01-02', '2027-01-02'],
    });
    expect(interpretarBusca('29/02', 2026)).toEqual({
      tipo: 'datas',
      datas: ['2024-02-29'],
    });
  });

  it('mm/aaaa é o mês; aaaa é o ano (intervalo semiaberto)', () => {
    expect(interpretarBusca('12/2025', 2026)).toEqual({
      tipo: 'intervalo',
      de: '2025-12-01',
      ate: '2026-01-01',
    });
    expect(interpretarBusca('2025', 2026)).toEqual({
      tipo: 'intervalo',
      de: '2025-01-01',
      ate: '2026-01-01',
    });
    expect(interpretarBusca('13/2025', 2026)).toEqual({ tipo: 'impossivel' });
  });
});

describe('escaparIlike', () => {
  it('escapa barra, % e _, e tira o * (curinga do PostgREST sem escape)', () => {
    expect(escaparIlike('50%_a\\b*')).toBe('50\\%\\_a\\\\b');
  });
});

describe('filtroDepoisDoCursor', () => {
  it('monta o or do cursor (data desc, id desc)', () => {
    expect(filtroDepoisDoCursor({ data: '2026-01-02', id: 'abc-1' })).toBe(
      'data.lt."2026-01-02",and(data.eq."2026-01-02",id.lt.abc-1)',
    );
  });

  it('recusa cursor fora do formato, para nada estranho entrar no or()', () => {
    expect(() =>
      filtroDepoisDoCursor({ data: '2026-01-02),or(id.gt.0', id: 'x' }),
    ).toThrow();
    expect(() =>
      filtroDepoisDoCursor({ data: '2026-01-02', id: 'a,b' }),
    ).toThrow();
  });
});

describe('buscarRotas', () => {
  it('primeira página: 100 rotas mais recentes e o total da loja', async () => {
    montar(rotas(437));

    const { rotas: pagina, total } = await buscarRotas({
      filtros: filtros(),
      quantidade: TAMANHO_PAGINA_ROTAS,
      contar: true,
    });

    expect(total).toBe(437);
    expect(pagina).toHaveLength(100);
    expect(pagina[0].id).toBe('r00436');
    expect(pagina[99].id).toBe('r00337');
  });

  it('página seguinte pelo cursor: sem repetir nem pular, mesmo com exclusão no meio', async () => {
    const linhas = rotas(250);
    montar(linhas);

    const p1 = await buscarRotas({
      filtros: filtros(),
      quantidade: 100,
      contar: true,
    });
    // Uma rota da página 1 é excluída entre um clique e outro: com OFFSET a
    // página 2 começaria uma linha adiante e pularia uma rota.
    linhas.splice(
      linhas.findIndex((l) => l.id === 'r00200'),
      1,
    );
    const ultima = p1.rotas[p1.rotas.length - 1];
    const p2 = await buscarRotas({
      filtros: filtros(),
      quantidade: 100,
      cursor: { data: ultima.data, id: ultima.id },
    });

    expect(p2.rotas[0].id).toBe('r00149');
    expect(p2.rotas).toHaveLength(100);
    const ids = new Set([...p1.rotas, ...p2.rotas].map((r) => r.id));
    expect(ids.size).toBe(200);
  });

  it('busca tudo em páginas além do corte de 1.000 linhas, com progresso', async () => {
    const falso = montar(rotas(2345));
    const progresso: [number, number | null][] = [];

    const { rotas: todas, total } = await buscarRotas({
      filtros: filtros(),
      quantidade: TETO_EXPORTACAO_ROTAS,
      contar: true,
      aoProgredir: (carregadas, t) => progresso.push([carregadas, t]),
    });

    expect(total).toBe(2345);
    expect(todas).toHaveLength(2345);
    expect(new Set(todas.map((r) => r.id)).size).toBe(2345);
    expect(progresso).toEqual([
      [1000, 2345],
      [2000, 2345],
      [2345, 2345],
    ]);
    // Uma única contagem (a da 1ª página): as outras não pedem count.
    const contagens = falso.requisicoes.filter(
      (r) => r.tabela === 'rotas' && /count=exact/.test(r.prefer ?? ''),
    );
    expect(contagens).toHaveLength(1);
  });

  it('para no teto pedido', async () => {
    montar(rotas(1500));

    const { rotas: parte, total } = await buscarRotas({
      filtros: filtros(),
      quantidade: 1200,
      contar: true,
    });

    expect(total).toBe(1500);
    expect(parte).toHaveLength(1200);
  });

  it('filtro de status vai ao servidor', async () => {
    montar(rotas(300));

    const { rotas: concluidas, total } = await buscarRotas({
      filtros: filtros({ status: 'concluida' }),
      quantidade: 100,
      contar: true,
    });

    expect(total).toBe(100);
    expect(concluidas.every((r) => r.status === 'concluida')).toBe(true);
  });

  it('busca por nome cobre rotas antigas, só o motorista certo, e trata % _ , como texto', async () => {
    // 'Ana B' e 'Bruno 501' só casariam com `_` e `%` tratados como curinga.
    const nomes = ['Ana B', 'Bruno 501', '50% Ana', 'Ana_B', 'Silva, Ana'];
    montar(
      rotas(500, (i) =>
        i === 3
          ? { motorista_id: null, usuarios: null }
          : {
              motorista_id: `m${i % 5}`,
              usuarios: { id: `m${i % 5}`, nome: nomes[i % 5] },
            },
      ),
    );

    const porNome = async (busca: string) =>
      (
        await buscarRotas({
          filtros: filtros({ busca }),
          quantidade: 1000,
          contar: true,
        })
      ).rotas.map((r) => r.motorista_nome);

    const bruno = await porNome('bru');
    expect(bruno).toHaveLength(100);
    expect(new Set(bruno)).toEqual(new Set(['Bruno 501']));
    // A rota mais antiga do Bruno (r00001) também vem.
    expect(new Set(await porNome('50%'))).toEqual(new Set(['50% Ana']));
    expect(new Set(await porNome('a_b'))).toEqual(new Set(['Ana_B']));
    expect(new Set(await porNome('silva, a'))).toEqual(new Set(['Silva, Ana']));
  });

  it('busca por data vai ao servidor', async () => {
    montar(rotas(800));

    const { rotas: doDia } = await buscarRotas({
      filtros: filtros({ busca: '02/01/2024' }),
      quantidade: 100,
      contar: true,
    });

    expect(doDia.map((r) => r.id).sort()).toEqual(['r00002', 'r00003']);
  });

  it('busca impossível não consulta e volta vazia', async () => {
    const falso = montar(rotas(10));

    const r = await buscarRotas({
      filtros: filtros({ busca: '31/02/2026' }),
      quantidade: 100,
      contar: true,
    });

    expect(r).toEqual({ rotas: [], total: 0 });
    expect(falso.requisicoes).toHaveLength(0);
  });

  it('conta as paradas das rotas devolvidas (sem partida/chegada)', async () => {
    montar(rotas(2), [
      { id: 'p1', rota_id: 'r00001', status: 'concluida', is_checkpoint: true },
      { id: 'p2', rota_id: 'r00001', status: 'pendente', is_checkpoint: true },
      { id: 'p3', rota_id: 'r00001', status: 'pendente', is_checkpoint: false },
    ]);

    const { rotas: lista } = await buscarRotas({
      filtros: filtros(),
      quantidade: 100,
    });

    expect(lista[0]).toMatchObject({
      id: 'r00001',
      motorista_nome: 'Ana',
      paradas_count: 2,
      paradas_concluidas: 1,
    });
  });
});

describe('contarRotasPorStatus', () => {
  it('conta concluídas e pendentes de toda a loja, com a mesma busca', async () => {
    montar(rotas(437));

    expect(await contarRotasPorStatus(filtros())).toEqual({
      concluidas: 146,
      pendentes: 291,
    });
  });

  it('com filtro de outro status, o contador fica zero sem consulta', async () => {
    const falso = montar(rotas(30));

    expect(await contarRotasPorStatus(filtros({ status: 'pendente' }))).toEqual(
      { concluidas: 0, pendentes: 20 },
    );
    expect(falso.requisicoes).toHaveLength(1);
  });
});
