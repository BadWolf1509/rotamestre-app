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
  nomeMotoristaDaRota,
  ROTULO_MOTORISTA_OCULTO,
  TAMANHO_PAGINA_ROTAS,
  TETO_EXPORTACAO_ROTAS,
  type FiltrosRotas,
} from '../consultaRotas';

let mockCliente: ReturnType<typeof criarPostgrestFalso>['cliente'];
// RPC nomes_motoristas_das_rotas (Migration 72): por padrão não devolve nome.
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (t: string) => mockCliente.from(t),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  isSupabaseConfigured: true,
}));

beforeEach(() => {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: [], error: null });
});

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
  periodo: { de: null, ate: null },
  ...f,
});

describe('interpretarBusca', () => {
  it('texto vira busca por nome do motorista, com curingas escapados', () => {
    expect(interpretarBusca('ana')).toEqual({
      tipo: 'nome',
      padrao: '%ana%',
      incluiSemMotorista: false,
    });
    expect(interpretarBusca('  ')).toEqual({ tipo: 'nenhuma' });
  });

  it('data não é mais reconhecida: vira busca por texto', () => {
    for (const termo of ['05/10/2026', '02/01', '12/2025', '2025']) {
      expect(interpretarBusca(termo)).toEqual({
        tipo: 'nome',
        padrao: `%${termo}%`,
        incluiSemMotorista: false,
      });
    }
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
  it('motorista que a RLS esconde: mantém o motorista_id e usa o rótulo, não "sem motorista"', async () => {
    montar(
      rotas(2, (i) =>
        i === 0
          ? { motorista_id: 'm9', usuarios: null }
          : { motorista_id: null, usuarios: null },
      ),
    );

    const { rotas: pagina } = await buscarRotas({
      filtros: filtros(),
      quantidade: 10,
    });
    const oculta = pagina.find((r) => r.id === 'r00000');
    const sem = pagina.find((r) => r.id === 'r00001');

    expect(oculta?.motorista_id).toBe('m9');
    expect(oculta?.motorista_nome).toBe(ROTULO_MOTORISTA_OCULTO);
    expect(ROTULO_MOTORISTA_OCULTO).toBe('Motorista removido da loja');
    expect(sem?.motorista_id).toBeUndefined();
    expect(sem?.motorista_nome).toBeUndefined();
  });

  it('buscarRotas preenche o nome fora da loja das rotas com embed vazio', async () => {
    montar(
      rotas(3, (i) =>
        i === 0
          ? { motorista_id: 'm9', usuarios: null }
          : i === 1
            ? { motorista_id: 'm8', usuarios: null }
            : {},
      ),
    );
    mockRpc.mockResolvedValue({
      data: [{ rota_id: 'r00000', nome: 'Bia' }],
      error: null,
    });

    const { rotas: pagina } = await buscarRotas({
      filtros: filtros(),
      quantidade: 10,
    });
    const nome = (id: string) =>
      pagina.find((r) => r.id === id)?.motorista_nome;

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('nomes_motoristas_das_rotas', {
      p_rota_ids: ['r00001', 'r00000'],
    });
    expect(nome('r00000')).toBe('Bia (fora da loja)');
    // A RPC não devolveu nome: segue o rótulo de hoje.
    expect(nome('r00001')).toBe(ROTULO_MOTORISTA_OCULTO);
    expect(nome('r00002')).toBe('Ana');
  });

  it('sem rota oculta, a RPC não é chamada', async () => {
    montar(rotas(3));

    await buscarRotas({ filtros: filtros(), quantidade: 10 });

    expect(mockRpc).not.toHaveBeenCalled();
  });

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

  it('"sem motorista" acha as rotas sem motorista, também junto com nomes que casam', async () => {
    // A lista mostra "Sem motorista" nessas rotas, e a busca no cliente
    // (antes da tarefa 6) casava esse texto. Com o `!inner`, elas sumiam.
    const nomes = ['Ana', 'Semíramis', 'Bruno'];
    montar(
      rotas(1500, (i) =>
        i % 4 === 0
          ? { motorista_id: null, usuarios: null }
          : {
              motorista_id: `m${i % 3}`,
              usuarios: { id: `m${i % 3}`, nome: nomes[i % 3] },
            },
      ),
    );

    const busca = async (termo: string) =>
      buscarRotas({
        filtros: filtros({ busca: termo }),
        quantidade: 2000,
        contar: true,
      });
    const nomesDe = (r: Awaited<ReturnType<typeof busca>>) =>
      new Set(r.rotas.map((x) => x.motorista_nome ?? null));

    const semMotorista = await busca('Sem Motorista');
    expect(nomesDe(semMotorista)).toEqual(new Set([null]));
    // 375 rotas sem motorista, atravessando a página de 1.000 (cursor + or).
    expect(semMotorista.rotas).toHaveLength(375);
    expect(semMotorista.total).toBe(375);

    // "sem" casa as duas coisas, como casava no cliente.
    const sem = await busca('sem');
    expect(nomesDe(sem)).toEqual(new Set([null, 'Semíramis']));
    expect(new Set(sem.rotas.map((r) => r.id)).size).toBe(sem.rotas.length);

    // Nome que não é pedaço de "sem motorista" não traz as sem motorista.
    expect(nomesDe(await busca('ana'))).toEqual(new Set(['Ana']));

    expect(
      await contarRotasPorStatus(filtros({ busca: 'sem motorista' })),
    ).toEqual({
      concluidas: semMotorista.rotas.filter((r) => r.status === 'concluida')
        .length,
      pendentes: semMotorista.rotas.filter((r) => r.status !== 'concluida')
        .length,
    });
  });

  it('período vai ao servidor como intervalo fechado em data (gte/lte)', async () => {
    const falso = montar(rotas(800));

    const { rotas: doPeriodo, total } = await buscarRotas({
      filtros: filtros({ periodo: { de: '2024-01-02', ate: '2024-01-03' } }),
      quantidade: 100,
      contar: true,
    });

    // 2 rotas por dia: os dois extremos entram.
    expect(doPeriodo.map((r) => r.id).sort()).toEqual([
      'r00002',
      'r00003',
      'r00004',
      'r00005',
    ]);
    expect(total).toBe(4);
    const filtrosData = falso.requisicoes
      .find((r) => r.tabela === 'rotas')
      ?.url.searchParams.getAll('data');
    expect(filtrosData).toEqual(['gte.2024-01-02', 'lte.2024-01-03']);
  });

  it('período sem pontas não filtra por data; ponta nula é ignorada', async () => {
    const falso = montar(rotas(10));

    await buscarRotas({ filtros: filtros(), quantidade: 100 });
    await buscarRotas({
      filtros: filtros({ periodo: { de: null, ate: '2024-01-02' } }),
      quantidade: 100,
    });

    const requisicoesDeRotas = falso.requisicoes.filter(
      (r) => r.tabela === 'rotas',
    );
    const dataDe = (i: number) =>
      requisicoesDeRotas[i].url.searchParams.getAll('data');
    expect(dataDe(0)).toEqual([]);
    expect(dataDe(1)).toEqual(['lte.2024-01-02']);
  });

  it('o cursor e a página seguinte respeitam o período', async () => {
    montar(rotas(40)); // 2024-01-01 .. 2024-01-20, 2 por dia
    const periodo = { de: '2024-01-05', ate: '2024-01-10' };

    const p1 = await buscarRotas({
      filtros: filtros({ periodo }),
      quantidade: 5,
      contar: true,
    });
    const ultima = p1.rotas[p1.rotas.length - 1];
    const p2 = await buscarRotas({
      filtros: filtros({ periodo }),
      quantidade: 100,
      cursor: { data: ultima.data, id: ultima.id },
    });

    expect(p1.total).toBe(12);
    expect(p2.rotas).toHaveLength(7);
    expect(
      [...p1.rotas, ...p2.rotas].every(
        (r) => r.data >= periodo.de && r.data <= periodo.ate,
      ),
    ).toBe(true);
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
  it('conta só as rotas do período', async () => {
    montar(rotas(40));

    const c = await contarRotasPorStatus(
      filtros({ periodo: { de: '2024-01-05', ate: '2024-01-10' } }),
    );

    expect(c.concluidas + c.pendentes).toBe(12);
  });

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

describe('nomeMotoristaDaRota', () => {
  it('mostra o nome quando o embed trouxe o motorista', () => {
    expect(nomeMotoristaDaRota('Ana', 'm1')).toBe('Ana');
  });

  it('rota com motorista_id e embed escondido pela RLS não vira "Sem motorista"', () => {
    expect(nomeMotoristaDaRota(undefined, 'm1')).toBe(ROTULO_MOTORISTA_OCULTO);
    expect(nomeMotoristaDaRota(null, 'm1')).toBe(ROTULO_MOTORISTA_OCULTO);
    expect(nomeMotoristaDaRota('', 'm1')).toBe(ROTULO_MOTORISTA_OCULTO);
  });

  it("nomeMotoristaDaRota com nome fora da loja: 'Ana (fora da loja)'", () => {
    expect(nomeMotoristaDaRota(undefined, 'm1', 'Ana')).toBe(
      'Ana (fora da loja)',
    );
    // O nome visível vence: o 3º argumento só vale para o embed vazio.
    expect(nomeMotoristaDaRota('Bia', 'm1', 'Ana')).toBe('Bia');
  });

  it('nomeMotoristaDaRota sem nome fora da loja mantém ROTULO_MOTORISTA_OCULTO', () => {
    expect(nomeMotoristaDaRota(undefined, 'm1', null)).toBe(
      ROTULO_MOTORISTA_OCULTO,
    );
    expect(nomeMotoristaDaRota(undefined, 'm1', '')).toBe(
      ROTULO_MOTORISTA_OCULTO,
    );
    expect(nomeMotoristaDaRota(undefined, null, 'Ana')).toBe('Sem motorista');
  });

  it('só é "Sem motorista" quando a rota não tem motorista_id', () => {
    expect(nomeMotoristaDaRota(undefined, null)).toBe('Sem motorista');
    expect(nomeMotoristaDaRota(null, undefined)).toBe('Sem motorista');
  });
});
