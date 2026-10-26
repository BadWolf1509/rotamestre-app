import {
  chaveDaCopia,
  escolherRotaDoMapa,
  montarParadasDaCopia,
  STATUS_ENCERRADOS,
  TELEFONE_PADRAO_DA_COPIA,
} from '../planoDaRotaDoMapa';

const rota = (
  id: string,
  status: string,
  data: string,
  created_at = `${data}T12:00:00Z`,
) => ({
  id,
  status,
  data,
  created_at,
  iniciada_em: null as string | null,
  concluida_em: null as string | null,
});

describe('escolherRotaDoMapa (qual rota o fixture usa, ou se cria uma)', () => {
  it('sem rota nenhuma: sem-rota', () => {
    expect(escolherRotaDoMapa([])).toEqual({ tipo: 'sem-rota' });
  });

  it('só rotas encerradas: cria a partir da mais recente', () => {
    const plano = escolherRotaDoMapa([
      rota('velha', 'concluida', '2026-09-01'),
      rota('nova', 'cancelada', '2026-10-20'),
      rota('meio', 'nao_executada', '2026-10-01'),
    ]);
    expect(plano).toEqual({
      tipo: 'criar',
      modelo: expect.objectContaining({ id: 'nova' }),
    });
  });

  it('empate de data entre encerradas: a criada por último é o modelo', () => {
    const plano = escolherRotaDoMapa([
      rota('a', 'concluida', '2026-10-20', '2026-10-20T08:00:00Z'),
      rota('b', 'concluida', '2026-10-20', '2026-10-20T09:00:00Z'),
    ]);
    expect(plano).toEqual({
      tipo: 'criar',
      modelo: expect.objectContaining({ id: 'b' }),
    });
  });

  it('nunca escolhe rota encerrada para usar (o status dela não volta mais)', () => {
    for (const status of STATUS_ENCERRADOS) {
      const plano = escolherRotaDoMapa([rota('x', status, '2026-10-25')]);
      expect(plano.tipo).toBe('criar');
    }
  });

  it('com rota aberta não cria outra, mesmo que a mais recente esteja encerrada', () => {
    const plano = escolherRotaDoMapa([
      rota('aberta', 'em_andamento', '2026-09-11'),
      rota('encerrada', 'concluida', '2026-10-25'),
    ]);
    expect(plano).toEqual({
      tipo: 'usar',
      rota: expect.objectContaining({ id: 'aberta' }),
    });
  });

  it('usa a mesma rota que o app do motorista: em_andamento de data mais antiga', () => {
    const plano = escolherRotaDoMapa([
      rota('pendente-antiga', 'pendente', '2026-10-01'),
      rota('andamento-nova', 'em_andamento', '2026-10-25'),
      rota('andamento-antiga', 'em_andamento', '2026-10-20'),
    ]);
    expect(plano).toEqual({
      tipo: 'usar',
      rota: expect.objectContaining({ id: 'andamento-antiga' }),
    });
  });

  it('empate de data entre em_andamento: a criada primeiro (como o app)', () => {
    const plano = escolherRotaDoMapa([
      rota('b', 'em_andamento', '2026-10-20', '2026-10-20T09:00:00Z'),
      rota('a', 'em_andamento', '2026-10-20', '2026-10-20T08:00:00Z'),
    ]);
    expect(plano).toEqual({
      tipo: 'usar',
      rota: expect.objectContaining({ id: 'a' }),
    });
  });

  it('sem em_andamento: a pendente de data mais antiga', () => {
    const plano = escolherRotaDoMapa([
      rota('p2', 'pendente', '2026-10-25'),
      rota('p1', 'pendente', '2026-10-22'),
      rota('c', 'concluida', '2026-10-26'),
    ]);
    expect(plano).toEqual({
      tipo: 'usar',
      rota: expect.objectContaining({ id: 'p1' }),
    });
  });
});

describe('chaveDaCopia (idempotência entre PRs concorrentes)', () => {
  it('mesmo modelo, mesma chave; modelos diferentes, chaves diferentes', () => {
    const a = chaveDaCopia('4c9eaaae-4610-4d3d-9fa2-08116116106a');
    expect(chaveDaCopia('4c9eaaae-4610-4d3d-9fa2-08116116106a')).toBe(a);
    expect(chaveDaCopia('63ed147c-9651-40ee-9a35-8350d76ef25b')).not.toBe(a);
  });

  it('tem formato de uuid (a RPC recebe p_request_id uuid)', () => {
    expect(chaveDaCopia('qualquer')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('montarParadasDaCopia (p_paradas de criar_rota_com_paradas)', () => {
  const base = {
    tipo: 'entrega',
    latitude: -7.1,
    longitude: -34.8,
    observacoes: null as string | null,
  };
  const modelo = [
    // fora de ordem de propósito
    {
      ...base,
      ordem: 2,
      is_checkpoint: true,
      endereco: 'Rua B',
      destinatario: 'Ana',
      telefone: '(83) 99999-1234',
      observacoes: 'portão azul',
    },
    {
      ...base,
      ordem: 0,
      is_checkpoint: false,
      endereco: 'Sede',
      destinatario: null,
      telefone: null,
    },
    {
      ...base,
      ordem: 1,
      is_checkpoint: true,
      tipo: 'retirada',
      endereco: 'Rua A',
      destinatario: null,
      telefone: '123',
    },
    {
      ...base,
      ordem: 3,
      is_checkpoint: false,
      endereco: 'Sede',
      destinatario: null,
      telefone: null,
    },
  ];

  it('mantém ordem, tipo, endereço, coordenadas e checkpoints do modelo', () => {
    const paradas = montarParadasDaCopia(modelo);
    expect(paradas.map((p) => [p.ordem, p.is_checkpoint, p.endereco])).toEqual([
      [0, false, 'Sede'],
      [1, true, 'Rua A'],
      [2, true, 'Rua B'],
      [3, false, 'Sede'],
    ]);
    expect(paradas[1].tipo).toBe('retirada');
    expect(paradas[2]).toMatchObject({
      latitude: -7.1,
      longitude: -34.8,
      destinatario: 'Ana',
      telefone: '(83) 99999-1234',
      observacoes: 'portão azul',
    });
  });

  it('completa destinatário e telefone que a RPC exige nas paradas reais', () => {
    const paradas = montarParadasDaCopia(modelo);
    expect(paradas[1].destinatario).toBe('Cliente demo E2E');
    expect(paradas[1].telefone).toBe(TELEFONE_PADRAO_DA_COPIA);
    expect(TELEFONE_PADRAO_DA_COPIA.replace(/\D/g, '')).toHaveLength(11);
  });

  it('dá _temp_id único às paradas reais, sem vínculo entre elas', () => {
    const paradas = montarParadasDaCopia(modelo);
    const reais = paradas.filter((p) => p.is_checkpoint);
    expect(new Set(reais.map((p) => p._temp_id)).size).toBe(reais.length);
    expect(paradas.some((p) => '_temp_vinculo_id' in p)).toBe(false);
  });

  it('renumera a ordem sem buraco (a RPC exige 0, 1..n, n+1)', () => {
    const comBuraco = modelo.map((p) =>
      p.ordem === 0 ? p : { ...p, ordem: p.ordem * 10 },
    );
    const paradas = montarParadasDaCopia(comBuraco);
    expect(paradas.map((p) => [p.ordem, p.endereco])).toEqual([
      [0, 'Sede'],
      [1, 'Rua A'],
      [2, 'Rua B'],
      [3, 'Sede'],
    ]);
  });

  it('modelo sem partida e chegada não serve', () => {
    expect(() =>
      montarParadasDaCopia(modelo.filter((p) => p.is_checkpoint)),
    ).toThrow(/partida e chegada/);
  });

  it('modelo sem parada real não serve', () => {
    expect(() =>
      montarParadasDaCopia(modelo.filter((p) => !p.is_checkpoint)),
    ).toThrow(/parada real/);
  });
});
