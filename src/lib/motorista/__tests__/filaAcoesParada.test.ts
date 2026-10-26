/**
 * Fila de ações de parada (concluir/pular) feitas sem rede.
 *
 * O banco aqui é um FAKE em memória com as mesmas regras que importam no
 * servidor: a RLS esconde parada de rota de outro motorista, e o UPDATE
 * condicional só muda parada ainda aberta. Assim os testes julgam o
 * comportamento (o que fica no banco, o que fica na fila), não chamadas.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  acoesQueSubiram,
  aplicarAcaoParada,
  criarAcaoParada,
  enfileirarAcaoParada,
  lerDescartesDaFila,
  lerFilaAcoesParada,
  processarFilaAcoesParada,
  ehFalhaDeEnvio,
  ehErroDefinitivo,
  dispensarDescartes,
  sobreporAcoesPendentes,
  _resetFilaAcoesParada,
  MAX_TENTATIVAS,
  type PortaParadas,
} from '../filaAcoesParada';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mapa = new Map<string, string>();
  return {
    __mapa: mapa,
    getItem: jest.fn(async (k: string) => mapa.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      mapa.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      mapa.delete(k);
    }),
  };
});

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

interface ParadaFake {
  id: string;
  rota_id: string;
  status: string;
  ordem: number;
  is_checkpoint?: boolean;
  concluida_em?: string | null;
  motivo_skip?: string | null;
  observacoes?: string | null;
  observacao_pulo?: string | null;
}
interface RotaFake {
  id: string;
  status: string;
  motorista_id: string;
}

function criarBanco(usuario: string) {
  const paradas = new Map<string, ParadaFake>();
  const rotas = new Map<string, RotaFake>();
  let falha: Error | null = null;
  let updates = 0;

  const visivel = (p: ParadaFake) =>
    rotas.get(p.rota_id)?.motorista_id === usuario;

  const porta: PortaParadas = {
    async lerParada(id) {
      if (falha) throw falha;
      const p = paradas.get(id);
      if (!p || !visivel(p)) return null;
      const r = rotas.get(p.rota_id)!;
      return {
        status: p.status,
        rota_id: p.rota_id,
        rota: { status: r.status, motorista_id: r.motorista_id },
      };
    },
    async atualizarSeAberta(id, dados) {
      if (falha) throw falha;
      const p = paradas.get(id);
      if (!p || !visivel(p)) return false;
      if (p.status !== 'pendente' && p.status !== 'em_andamento') return false;
      updates++;
      Object.assign(p, dados);
      return true;
    },
    async avancarProxima(rotaId) {
      if (falha) throw falha;
      const daRota = [...paradas.values()]
        .filter((p) => p.rota_id === rotaId && p.is_checkpoint !== false)
        .sort((a, b) => a.ordem - b.ordem);
      if (daRota.some((p) => p.status === 'em_andamento')) return;
      const prox = daRota.find((p) => p.status === 'pendente');
      if (prox) prox.status = 'em_andamento';
    },
  };

  return {
    porta,
    paradas,
    rotas,
    get updates() {
      return updates;
    },
    falharCom(e: Error | null) {
      falha = e;
    },
  };
}

const ERRO_DE_REDE = new TypeError('Network request failed');

function cenario() {
  const banco = criarBanco('mot-1');
  banco.rotas.set('rota-1', {
    id: 'rota-1',
    status: 'em_andamento',
    motorista_id: 'mot-1',
  });
  banco.paradas.set('p1', {
    id: 'p1',
    rota_id: 'rota-1',
    status: 'em_andamento',
    ordem: 1,
  });
  banco.paradas.set('p2', {
    id: 'p2',
    rota_id: 'rota-1',
    status: 'pendente',
    ordem: 2,
  });
  return banco;
}

const concluirP1 = () =>
  criarAcaoParada({
    tipo: 'concluir',
    paradaId: 'p1',
    rotaId: 'rota-1',
    motoristaId: 'mot-1',
    em: '2026-10-23T12:00:00.000Z',
  });

beforeEach(() => {
  (AsyncStorage as unknown as { __mapa: Map<string, string> }).__mapa.clear();
  _resetFilaAcoesParada();
});

describe('aplicarAcaoParada (idempotente no servidor)', () => {
  it('conclui a parada aberta com o horário da ação, não o do envio', async () => {
    const banco = cenario();
    const r = await aplicarAcaoParada(concluirP1(), banco.porta);
    expect(r).toEqual({ tipo: 'aplicada' });
    expect(banco.paradas.get('p1')).toMatchObject({
      status: 'concluida',
      concluida_em: '2026-10-23T12:00:00.000Z',
    });
  });

  it('reenviar não duplica nem regride: a segunda vez é "já resolvida" e não escreve', async () => {
    const banco = cenario();
    await aplicarAcaoParada(concluirP1(), banco.porta);
    const r = await aplicarAcaoParada(concluirP1(), banco.porta);
    expect(r).toEqual({ tipo: 'ja_resolvida', status: 'concluida' });
    expect(banco.updates).toBe(1);
  });

  it('pular não desfaz uma conclusão feita por outro caminho', async () => {
    const banco = cenario();
    banco.paradas.get('p1')!.status = 'concluida';
    const r = await aplicarAcaoParada(
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:00:00.000Z',
        motivo: 'cliente_ausente',
      }),
      banco.porta,
    );
    // A conclusão vale; o pulo vira aviso (status_divergente).
    expect(r).toEqual({ tipo: 'descartada', motivo: 'status_divergente' });
    expect(banco.paradas.get('p1')!.status).toBe('concluida');
  });

  it('pular grava motivo e o texto do motorista em observacao_pulo, sem tocar a observação do gestor', async () => {
    const banco = cenario();
    banco.paradas.get('p1')!.observacoes = 'Portão azul, tocar o interfone';
    await aplicarAcaoParada(
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:00:00.000Z',
        motivo: 'recusa',
        observacoes: 'portão fechado',
      }),
      banco.porta,
    );
    expect(banco.paradas.get('p1')).toMatchObject({
      status: 'pulada',
      motivo_skip: 'recusa',
      observacao_pulo: 'portão fechado',
      observacoes: 'Portão azul, tocar o interfone',
    });
  });

  describe('observação do pulo (Migration 73: campo próprio)', () => {
    function capturarDados(banco: ReturnType<typeof cenario>) {
      const enviados: Record<string, unknown>[] = [];
      const original = banco.porta.atualizarSeAberta;
      banco.porta.atualizarSeAberta = async (id, dados) => {
        enviados.push(dados);
        return original(id, dados);
      };
      return enviados;
    }

    const pularP1 = (extra: {
      motivo?: 'outro' | 'recusa';
      observacoes?: string;
    }) =>
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:00:00.000Z',
        ...extra,
      });

    it('pular grava observacao_pulo e nunca observacoes', async () => {
      const banco = cenario();
      const enviados = capturarDados(banco);
      await aplicarAcaoParada(
        pularP1({ observacoes: 'Portão fechado' }),
        banco.porta,
      );
      expect(enviados).toEqual([
        {
          status: 'pulada',
          motivo_skip: 'outro',
          observacao_pulo: 'Portão fechado',
          concluida_em: '2026-10-23T12:00:00.000Z',
        },
      ]);
      expect(enviados[0]).not.toHaveProperty('observacoes');
    });

    it('pular sem texto grava observacao_pulo: null (limpa o texto de um pulo anterior)', async () => {
      const banco = cenario();
      banco.paradas.get('p1')!.observacao_pulo = 'Ficou para amanhã';
      const enviados = capturarDados(banco);
      await aplicarAcaoParada(pularP1({ motivo: 'recusa' }), banco.porta);
      expect(enviados).toEqual([
        {
          status: 'pulada',
          motivo_skip: 'recusa',
          observacao_pulo: null,
          concluida_em: '2026-10-23T12:00:00.000Z',
        },
      ]);
      expect(banco.paradas.get('p1')!.observacao_pulo).toBeNull();
    });

    it('ação da fila gravada pela 1.14.7 (campo observacoes) sai como observacao_pulo', async () => {
      const banco = cenario();
      banco.paradas.get('p1')!.observacoes = 'Ligar antes';
      const enviados = capturarDados(banco);
      // Exatamente o JSON que a 1.14.7 deixou no aparelho.
      await AsyncStorage.setItem(
        '@rotamestre:fila_acoes_parada',
        JSON.stringify([
          {
            id: 'acao-1147',
            tipo: 'pular',
            paradaId: 'p1',
            rotaId: 'rota-1',
            motoristaId: 'mot-1',
            em: '2026-10-25T18:00:00.000Z',
            motivo: 'cliente_ausente',
            observacoes: 'Ficou para tarde',
            tentativas: 0,
          },
        ]),
      );
      _resetFilaAcoesParada();
      const r = await processarFilaAcoesParada({
        usuarioAtual: 'mot-1',
        porta: banco.porta,
      });
      expect(r.enviadas).toBe(1);
      expect(enviados[0]).toEqual({
        status: 'pulada',
        motivo_skip: 'cliente_ausente',
        observacao_pulo: 'Ficou para tarde',
        // O horário real do pulo, não o da sincronização
        concluida_em: '2026-10-25T18:00:00.000Z',
      });
      expect(banco.paradas.get('p1')).toMatchObject({
        observacoes: 'Ligar antes',
        observacao_pulo: 'Ficou para tarde',
      });
    });

    it('concluir não leva observacoes nem observacao_pulo', async () => {
      const banco = cenario();
      const enviados = capturarDados(banco);
      await aplicarAcaoParada(concluirP1(), banco.porta);
      expect(enviados[0]).not.toHaveProperty('observacoes');
      expect(enviados[0]).not.toHaveProperty('observacao_pulo');
    });
  });

  it('parada removida pelo gestor é descartada (não é erro de rede)', async () => {
    const banco = cenario();
    banco.paradas.delete('p1');
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'parada_removida',
    });
  });

  it('rota reatribuída a outro motorista é descartada sem escrever', async () => {
    const banco = cenario();
    banco.rotas.get('rota-1')!.motorista_id = 'mot-2';
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'parada_removida',
    });
    expect(banco.updates).toBe(0);
  });

  it('rota que não está mais em andamento é descartada sem escrever', async () => {
    const banco = cenario();
    banco.rotas.get('rota-1')!.status = 'cancelada';
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'rota_encerrada',
    });
    expect(banco.updates).toBe(0);
  });

  it('parada movida para outra rota é descartada', async () => {
    const banco = cenario();
    banco.rotas.set('rota-2', {
      id: 'rota-2',
      status: 'em_andamento',
      motorista_id: 'mot-1',
    });
    banco.paradas.get('p1')!.rota_id = 'rota-2';
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'parada_removida',
    });
  });
});

describe('fila persistida por usuário', () => {
  it('enfileira e sobrevive a um "reinício" (lê do AsyncStorage)', async () => {
    await enfileirarAcaoParada(concluirP1());
    _resetFilaAcoesParada();
    const fila = await lerFilaAcoesParada();
    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ paradaId: 'p1', tipo: 'concluir' });
  });

  it('não guarda duas ações para a mesma parada (a primeira decisão vale)', async () => {
    await enfileirarAcaoParada(concluirP1());
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:05:00.000Z',
        motivo: 'outro',
      }),
    );
    const fila = await lerFilaAcoesParada();
    expect(fila).toHaveLength(1);
    expect(fila[0].tipo).toBe('concluir');
  });

  it('a ação de outra conta para a mesma parada não engole a desta conta', async () => {
    // Rota passada de A para B no mesmo aparelho: a ação de A vai ser
    // descartada no envio; a de B não pode sumir por causa dela.
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'outra-conta',
        em: '2026-10-23T12:00:00.000Z',
      }),
    );
    await enfileirarAcaoParada(concluirP1());
    const fila = await lerFilaAcoesParada();
    expect(fila.map((a) => a.motoristaId).sort()).toEqual([
      'mot-1',
      'outra-conta',
    ]);
  });
});

describe('processarFilaAcoesParada', () => {
  it('envia na ordem, esvazia a fila e avança a próxima parada', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    const r = await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    expect(r.enviadas).toBe(1);
    expect(await lerFilaAcoesParada()).toEqual([]);
    expect(banco.paradas.get('p1')!.status).toBe('concluida');
    expect(banco.paradas.get('p2')!.status).toBe('em_andamento');
  });

  it('só envia as ações de quem está logado; as de outra conta esperam', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'p1',
        rotaId: 'rota-1',
        motoristaId: 'outra-conta',
        em: '2026-10-23T12:00:00.000Z',
      }),
    );
    const r = await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    expect(r.enviadas).toBe(0);
    expect(await lerFilaAcoesParada()).toHaveLength(1);
    expect(banco.updates).toBe(0);
  });

  it('sem rede, a ação fica na fila (sem contar tentativa) para a próxima vez', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    banco.falharCom(ERRO_DE_REDE);
    await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    const fila = await lerFilaAcoesParada();
    expect(fila).toHaveLength(1);
    expect(fila[0].tentativas).toBe(0);

    banco.falharCom(null);
    await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    expect(await lerFilaAcoesParada()).toEqual([]);
    expect(banco.paradas.get('p1')!.status).toBe('concluida');
  });

  it('parada removida offline: sai da fila e vira aviso, sem loop', async () => {
    const banco = cenario();
    banco.paradas.delete('p1');
    await enfileirarAcaoParada(concluirP1());
    const r = await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    expect(r.descartadas).toHaveLength(1);
    expect(await lerFilaAcoesParada()).toEqual([]);
    const avisos = await lerDescartesDaFila('mot-1');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({
      motivo: 'parada_removida',
      acao: { paradaId: 'p1' },
    });
    await dispensarDescartes('mot-1');
    expect(await lerDescartesDaFila('mot-1')).toEqual([]);
  });

  it('erro definitivo do servidor que se repete é descartado depois do limite, não fica em loop', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    banco.falharCom(
      Object.assign(new Error('permission denied for table paradas'), {
        code: '42501',
      }),
    );
    for (let i = 0; i < 10; i++) {
      await processarFilaAcoesParada({
        usuarioAtual: 'mot-1',
        porta: banco.porta,
      });
    }
    expect(await lerFilaAcoesParada()).toEqual([]);
    const avisos = await lerDescartesDaFila('mot-1');
    expect(avisos[0].motivo).toBe('falha_persistente');
  });

  it('ação enfileirada DURANTE o envio não é apagada pela regravação da fila', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    const lerOriginal = banco.porta.lerParada;
    banco.porta.lerParada = async (id) => {
      await enfileirarAcaoParada(
        criarAcaoParada({
          tipo: 'pular',
          paradaId: 'p2',
          rotaId: 'rota-1',
          motoristaId: 'mot-1',
          em: '2026-10-23T12:01:00.000Z',
          motivo: 'outro',
        }),
      );
      banco.porta.lerParada = lerOriginal;
      return lerOriginal(id);
    };
    await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    const fila = await lerFilaAcoesParada();
    expect(fila.map((a) => a.paradaId)).toEqual(['p2']);
  });
});

describe('revisão 1: estado divergente, sessão e reagendamento', () => {
  it('concluiu offline, mas a parada foi pulada por outro caminho: descarte com aviso, não "enviada"', async () => {
    const banco = cenario();
    banco.paradas.get('p1')!.status = 'pulada';
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'status_divergente',
    });

    await enfileirarAcaoParada(concluirP1());
    const r = await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    expect(r.enviadas).toBe(0);
    expect((await lerDescartesDaFila('mot-1'))[0].motivo).toBe(
      'status_divergente',
    );
  });

  it('mesmo status já no banco continua "já resolvida" (reenvio idempotente)', async () => {
    const banco = cenario();
    banco.paradas.get('p1')!.status = 'concluida';
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'ja_resolvida',
      status: 'concluida',
    });
  });

  it('UPDATE não mudou nada e a releitura não explica: descarte, não "enviada"', async () => {
    const banco = cenario();
    banco.porta.atualizarSeAberta = async () => false;
    expect(await aplicarAcaoParada(concluirP1(), banco.porta)).toEqual({
      tipo: 'descartada',
      motivo: 'status_divergente',
    });
  });

  it.each([
    [{ code: 'PGRST301', message: 'JWT expired' }],
    [{ code: 'PGRST303', message: 'JWT expired' }],
    [{ status: 401, message: 'Unauthorized' }],
    [{ message: 'invalid JWT: token is expired' }],
  ])(
    'erro de sessão %p não conta tentativa: a ação espera a sessão',
    async (erro) => {
      const banco = cenario();
      await enfileirarAcaoParada(concluirP1());
      banco.falharCom(Object.assign(new Error(erro.message), erro));
      for (let i = 0; i < MAX_TENTATIVAS + 2; i++) {
        await processarFilaAcoesParada({
          usuarioAtual: 'mot-1',
          porta: banco.porta,
        });
      }
      const fila = await lerFilaAcoesParada();
      expect(fila).toHaveLength(1);
      expect(fila[0].tentativas).toBe(0);
      expect(await lerDescartesDaFila('mot-1')).toEqual([]);
    },
  );

  it('chamada recusada por já estar processando roda de novo ao terminar', async () => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    let liberar: () => void = () => undefined;
    const lerOriginal = banco.porta.lerParada;
    banco.porta.lerParada = async (id) => {
      if (id === 'p1') {
        await new Promise<void>((r) => {
          liberar = r;
        });
      }
      return lerOriginal(id);
    };

    const primeira = processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    await new Promise((r) => setTimeout(r, 0));
    // Chega uma ação nova enquanto a primeira rodada está presa na rede.
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p2',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:01:00.000Z',
        motivo: 'outro',
      }),
    );
    await processarFilaAcoesParada({
      usuarioAtual: 'mot-1',
      porta: banco.porta,
    });
    liberar();
    await primeira;

    expect(await lerFilaAcoesParada()).toEqual([]);
    expect(banco.paradas.get('p2')!.status).toBe('pulada');
  });
});

describe('revisão 2: só erro DEFINITIVO conta tentativa', () => {
  async function rodarVezes(banco: ReturnType<typeof cenario>, vezes: number) {
    for (let i = 0; i < vezes; i++) {
      await processarFilaAcoesParada({
        usuarioAtual: 'mot-1',
        porta: banco.porta,
      });
    }
  }

  it.each([
    ['502 sem code', { code: '', message: 'Bad Gateway' }],
    [
      '503 com HTML',
      {
        message:
          '<html><body>503 Service Temporarily Unavailable</body></html>',
      },
    ],
    ['504 com status', { status: 504, message: 'Gateway Timeout' }],
    ['429', { status: 429, message: 'Too Many Requests' }],
    ['408', { status: 408, message: 'Request Timeout' }],
  ])('%s: espera, não conta tentativa nem descarta', async (_nome, erro) => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    banco.falharCom(Object.assign(new Error(erro.message), erro));
    await rodarVezes(banco, MAX_TENTATIVAS + 2);
    const fila = await lerFilaAcoesParada();
    expect(fila).toHaveLength(1);
    expect(fila[0].tentativas).toBe(0);
    expect(await lerDescartesDaFila('mot-1')).toEqual([]);
  });

  it.each([
    ['23514 (check violation)', { code: '23514', message: 'check violation' }],
    ['42501 (permissão)', { code: '42501', message: 'permission denied' }],
    ['PGRST116', { code: 'PGRST116', message: 'no rows' }],
    ['400 com status', { status: 400, message: 'Bad Request' }],
  ])('%s: definitivo, conta e descarta no limite', async (_nome, erro) => {
    const banco = cenario();
    await enfileirarAcaoParada(concluirP1());
    banco.falharCom(Object.assign(new Error(erro.message), erro));
    await rodarVezes(banco, MAX_TENTATIVAS);
    expect(await lerFilaAcoesParada()).toEqual([]);
    expect((await lerDescartesDaFila('mot-1'))[0].motivo).toBe(
      'falha_persistente',
    );
  });
});

describe('sobreporAcoesPendentes (o que a tela mostra enquanto não sobe)', () => {
  const base = [
    { id: 'p1', status: 'em_andamento', ordem: 1 },
    { id: 'p2', status: 'pendente', ordem: 2 },
    { id: 'p3', status: 'pendente', ordem: 3 },
  ];

  it('mostra concluída/pulada as paradas com ação na fila desta rota e diz quais são', () => {
    const fila = [
      { ...concluirP1(), paradaId: 'p1' },
      criarAcaoParada({
        tipo: 'pular',
        paradaId: 'p2',
        rotaId: 'rota-1',
        motoristaId: 'mot-1',
        em: '2026-10-23T12:01:00.000Z',
        motivo: 'recusa',
      }),
    ];
    const r = sobreporAcoesPendentes(base, fila, 'rota-1');
    expect(r.paradas.map((p) => p.status)).toEqual([
      'concluida',
      'pulada',
      'pendente',
    ]);
    expect([...r.pendentes]).toEqual(['p1', 'p2']);
    // O pulo também mostra o horário da ação (a linha do tempo o lê)
    expect(r.paradas[1]).toMatchObject({
      concluida_em: '2026-10-23T12:01:00.000Z',
    });
  });

  it('ignora ação de outra rota e não troca a identidade sem fila', () => {
    const outra = { ...concluirP1(), rotaId: 'rota-9' };
    const r = sobreporAcoesPendentes(base, [outra], 'rota-1');
    expect(r.paradas).toBe(base);
    expect(r.pendentes.size).toBe(0);
  });

  it('o banco já resolveu a parada: o status do banco vale', () => {
    const r = sobreporAcoesPendentes(
      [{ id: 'p1', status: 'concluida', ordem: 1 }],
      [
        criarAcaoParada({
          tipo: 'pular',
          paradaId: 'p1',
          rotaId: 'rota-1',
          motoristaId: 'mot-1',
          em: '2026-10-23T12:01:00.000Z',
        }),
      ],
      'rota-1',
    );
    expect(r.paradas[0].status).toBe('concluida');
  });
});

describe('ehFalhaDeEnvio', () => {
  it.each([
    [new TypeError('Network request failed')],
    [new TypeError('Failed to fetch')],
    [Object.assign(new Error('timeout'), { name: 'AbortError' })],
    [{ message: 'TypeError: Network request failed', code: '' }],
  ])('%p é falha de envio (a ação vai para a fila)', (erro) => {
    expect(ehFalhaDeEnvio(erro)).toBe(true);
  });

  it('erro do servidor (RLS, constraint) não é falha de envio', () => {
    expect(
      ehFalhaDeEnvio({ message: 'permission denied', code: '42501' }),
    ).toBe(false);
  });
});

describe('ehErroDefinitivo — SQLSTATE transitório não conta tentativa', () => {
  // Deadlock, serialização, conexão, recurso esgotado e consulta cancelada
  // passam sozinhos: descartar a entrega por eles seria perder dado numa
  // disputa de trava (ex.: gestor inserindo parada enquanto o motorista envia).
  it.each([
    '40P01',
    '40001',
    '08006',
    '08001',
    '53300',
    '57014',
    '57P01',
    '58000',
  ])('%s espera, sem contar tentativa', (code) => {
    expect(ehErroDefinitivo({ code, message: 'transitório' })).toBe(false);
  });

  it.each(['23514', '42501', '22P02', 'PGRST116'])(
    '%s continua definitivo',
    (code) => {
      expect(ehErroDefinitivo({ code, message: 'recusa' })).toBe(true);
    },
  );
});

describe('acoesQueSubiram', () => {
  const acao = (paradaId: string) =>
    criarAcaoParada({
      tipo: 'concluir',
      paradaId,
      rotaId: 'r1',
      motoristaId: 'm1',
      em: '2026-10-24T12:00:00.000Z',
    });

  it('devolve só o que saiu da fila sem ter sido descartado', () => {
    const subiu = acao('p1');
    const descartada = acao('p2');
    const ficou = acao('p3');

    const resultado = acoesQueSubiram(
      [subiu, descartada, ficou],
      [ficou],
      [{ acao: descartada, motivo: 'parada_removida', em: 'x' }],
    );

    expect(resultado).toEqual([subiu]);
  });
});
