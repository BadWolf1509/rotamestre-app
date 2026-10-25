import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHAVES_DA_CONTA } from '@/lib/auth/limparEstadoLocal';
import { logger } from '@/lib/logger';

import {
  CHAVE_FILA_POSICOES,
  MAX_TENTATIVAS_POSICAO,
  TETO_FILA_POSICOES,
  TETO_MEDIDA_POSICAO,
  invalidarPosicoesEmVoo,
  registrarPosicao,
  sanearPosicao,
  type Posicao,
} from '../filaPosicoes';

jest.mock('@/lib/logger');

const mockInsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (linhas: unknown) => mockInsert(linhas) }),
  },
}));

// Sessão lida quando não há contexto de rastreamento do motorista.
const mockLerSessao = jest.fn();
jest.mock('@/lib/auth/sessao', () => ({
  lerSessao: () => mockLerSessao(),
}));

const memoria = new Map<string, string>();

const CHAVE_CONTEXTO = '@rotamestre:tracking_context';
const CHAVE_ULTIMO_USUARIO = '@rotamestre:ultimo_usuario';

/** Contexto de rastreamento gravado pela task, com o motorista dado. */
function contextoDe(motoristaId: string | null) {
  if (motoristaId === null) {
    memoria.delete(CHAVE_CONTEXTO);
    return;
  }
  memoria.set(
    CHAVE_CONTEXTO,
    JSON.stringify({
      rotaId: 'rota-a',
      motoristaId,
      motoristaNome: 'Motorista',
      startedAt: '2026-10-24T12:00:00Z',
    }),
  );
}

const ERRO_DE_REDE = { message: 'TypeError: Network request failed' };
const ERRO_DEFINITIVO = {
  code: '23503',
  message: 'insert or update on table violates foreign key constraint',
};

const ROTULO = '[Teste] Erro ao salvar';

function posicao(extra: Partial<Posicao> = {}): Posicao {
  return {
    motorista_id: 'm1',
    rota_id: 'rota-a',
    latitude: -7.1,
    longitude: -34.8,
    velocidade: null,
    precisao: 10,
    heading: null,
    ...extra,
  };
}

/** Horário de captura (epoch ms) de cada posição: 1, 2, 3… minutos. */
const minuto = (n: number) => Date.UTC(2026, 9, 24, 12, n);
const iso = (n: number) => new Date(minuto(n)).toISOString();

function semRede() {
  mockInsert.mockResolvedValue({ error: ERRO_DE_REDE });
}

function comRede() {
  mockInsert.mockResolvedValue({ error: null });
}

function filaGuardada(): {
  userId: string;
  posicoes: Array<Posicao & { timestamp: string }>;
} | null {
  const bruto = memoria.get(CHAVE_FILA_POSICOES);
  return bruto ? JSON.parse(bruto) : null;
}

/** Linhas enviadas em cada chamada de insert, sempre como lista. */
function lotesEnviados(): Array<Array<Record<string, unknown>>> {
  return mockInsert.mock.calls.map(([linhas]) =>
    Array.isArray(linhas) ? linhas : [linhas],
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  memoria.clear();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (k: string) => memoria.get(k) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      memoria.set(k, v);
    },
  );
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(
    async (k: string) => {
      memoria.delete(k);
    },
  );
  comRede();
  contextoDe('m1');
  mockLerSessao.mockResolvedValue({ session: null, offline: false });
});

describe('filaPosicoes', () => {
  it('com rede e fila vazia, envia uma linha e não guarda nada', async () => {
    const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

    expect(destino).toBe('enviada');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // O horário é o do GPS, não o do servidor (default NOW()): a posição pode
    // ter sido capturada segundos antes de o insert sair.
    expect(mockInsert).toHaveBeenCalledWith({
      ...posicao(),
      timestamp: iso(1),
    });
    expect(filaGuardada()).toBeNull();
  });

  it('fix sem horário válido sai com o relógio do aparelho, em vez de se perder', async () => {
    const agora = jest.spyOn(Date, 'now').mockReturnValue(minuto(7));
    try {
      const destino = await registrarPosicao(posicao(), Number.NaN, ROTULO);

      expect(destino).toBe('enviada');
      expect(mockInsert).toHaveBeenCalledWith({
        ...posicao(),
        timestamp: iso(7),
      });
    } finally {
      agora.mockRestore();
    }
  });

  it('sem rede, guarda a posição com o horário em que foi capturada', async () => {
    semRede();

    const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

    expect(destino).toBe('na_fila');
    expect(filaGuardada()).toEqual({
      userId: 'm1',
      posicoes: [{ ...posicao(), timestamp: iso(1) }],
      estourou: false,
    });
    expect(logger.warn).toHaveBeenCalledWith(ROTULO, ERRO_DE_REDE);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('quando a rede volta, envia a fila em lote junto com a posição nova e esvazia', async () => {
    semRede();
    await registrarPosicao(posicao({ latitude: 1 }), minuto(1), ROTULO);
    await registrarPosicao(posicao({ latitude: 2 }), minuto(2), ROTULO);
    mockInsert.mockClear();
    comRede();

    const destino = await registrarPosicao(
      posicao({ latitude: 3 }),
      minuto(3),
      ROTULO,
    );

    expect(destino).toBe('enviada');
    // Um lote só, em ordem cronológica: a posição nova chega por último, e o
    // marcador do gestor (que segue o último INSERT) termina nela.
    expect(lotesEnviados()).toEqual([
      [
        { ...posicao({ latitude: 1 }), timestamp: iso(1) },
        { ...posicao({ latitude: 2 }), timestamp: iso(2) },
        { ...posicao({ latitude: 3 }), timestamp: iso(3) },
      ],
    ]);
    expect(filaGuardada()).toBeNull();
  });

  it('cada posição guardada vai com a rota em que foi capturada', async () => {
    semRede();
    await registrarPosicao(posicao({ rota_id: 'rota-a' }), minuto(1), ROTULO);
    mockInsert.mockClear();
    comRede();

    await registrarPosicao(posicao({ rota_id: 'rota-b' }), minuto(2), ROTULO);

    expect(lotesEnviados()).toEqual([
      [{ ...posicao({ rota_id: 'rota-a' }), timestamp: iso(1) }],
      [{ ...posicao({ rota_id: 'rota-b' }), timestamp: iso(2) }],
    ]);
    expect(filaGuardada()).toBeNull();
  });

  it('se o lote falha por rede, nada se perde', async () => {
    semRede();
    await registrarPosicao(posicao({ latitude: 1 }), minuto(1), ROTULO);

    const destino = await registrarPosicao(
      posicao({ latitude: 2 }),
      minuto(2),
      ROTULO,
    );

    expect(destino).toBe('na_fila');
    expect(filaGuardada()?.posicoes.map((p) => p.latitude)).toEqual([1, 2]);
  });

  it('erro que não é de rede não entra na fila', async () => {
    mockInsert.mockResolvedValue({ error: ERRO_DEFINITIVO });

    const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

    expect(destino).toBe('perdida');
    expect(filaGuardada()).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(ROTULO, ERRO_DEFINITIVO);
  });

  it('erro definitivo de uma rota descarta só o lote dela, e as outras seguem', async () => {
    semRede();
    await registrarPosicao(posicao({ rota_id: 'apagada' }), minuto(1), ROTULO);
    await registrarPosicao(posicao({ rota_id: 'viva' }), minuto(2), ROTULO);
    mockInsert.mockClear();
    mockInsert.mockImplementation(async (linhas: Posicao[]) =>
      linhas[0].rota_id === 'apagada'
        ? { error: ERRO_DEFINITIVO }
        : { error: null },
    );

    await registrarPosicao(posicao({ rota_id: 'viva' }), minuto(3), ROTULO);

    expect(lotesEnviados().map((l) => l.length)).toEqual([1, 2]);
    expect(filaGuardada()).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('no teto, descarta as mais antigas e avisa uma vez por estouro', async () => {
    semRede();
    for (let i = 0; i < TETO_FILA_POSICOES + 3; i++) {
      await registrarPosicao(posicao({ latitude: i }), minuto(i), ROTULO);
    }

    const guardadas = filaGuardada()!.posicoes;
    expect(TETO_FILA_POSICOES).toBe(500);
    expect(guardadas).toHaveLength(TETO_FILA_POSICOES);
    expect(guardadas[0].latitude).toBe(3);
    expect(guardadas[guardadas.length - 1].latitude).toBe(
      TETO_FILA_POSICOES + 2,
    );
    const avisosDeTeto = (logger.warn as jest.Mock).mock.calls.filter(
      ([mensagem]) => mensagem !== ROTULO,
    );
    expect(avisosDeTeto).toHaveLength(1);
  });

  it('fila de outra conta é descartada, nunca enviada', async () => {
    semRede();
    contextoDe('outra');
    await registrarPosicao(
      posicao({ motorista_id: 'outra' }),
      minuto(1),
      ROTULO,
    );
    mockInsert.mockClear();
    comRede();
    contextoDe('m1');

    await registrarPosicao(posicao({ motorista_id: 'm1' }), minuto(2), ROTULO);

    expect(lotesEnviados().flat()).toEqual([
      expect.objectContaining({ motorista_id: 'm1' }),
    ]);
    expect(filaGuardada()).toBeNull();
  });

  it('sem rede, a posição de outra conta substitui a fila antiga', async () => {
    semRede();
    contextoDe('outra');
    await registrarPosicao(
      posicao({ motorista_id: 'outra' }),
      minuto(1),
      ROTULO,
    );
    contextoDe('m1');

    await registrarPosicao(posicao({ motorista_id: 'm1' }), minuto(2), ROTULO);

    expect(filaGuardada()?.userId).toBe('m1');
    expect(filaGuardada()?.posicoes.map((p) => p.motorista_id)).toEqual(['m1']);
  });

  it('duas posições quase juntas não enviam o mesmo lote duas vezes', async () => {
    semRede();
    await registrarPosicao(posicao({ latitude: 1 }), minuto(1), ROTULO);
    mockInsert.mockClear();
    // Rede de volta, mas lenta: o primeiro lote ainda está no ar quando a
    // segunda posição chega.
    let liberar: () => void = () => {};
    const lenta = new Promise<void>((r) => {
      liberar = r;
    });
    mockInsert.mockImplementation(async () => {
      await lenta;
      return { error: null };
    });

    const primeira = registrarPosicao(
      posicao({ latitude: 2 }),
      minuto(2),
      ROTULO,
    );
    const segunda = registrarPosicao(
      posicao({ latitude: 3 }),
      minuto(3),
      ROTULO,
    );
    // Só libera a rede depois que as duas já passaram da leitura da fila e o
    // primeiro lote está de fato no ar.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockInsert).toHaveBeenCalled();
    liberar();
    await Promise.all([primeira, segunda]);

    const latitudes = lotesEnviados()
      .flat()
      .map((l) => l.latitude);
    expect(latitudes.sort()).toEqual([1, 2, 3]);
    expect(filaGuardada()).toBeNull();
  });

  // Rodada 1: só recusa de DADO (FK, NOT NULL, CHECK, tipo) descarta o lote.
  // O resto pode ser passageiro — e o caso mais provável vem justamente na
  // volta de um período longo sem rede (token vencido, refresh que falhou).
  describe('erro do lote que pode ser passageiro mantém a fila', () => {
    it.each([
      ['JWT expirado (PGRST301)', { code: 'PGRST301', message: 'JWT expired' }],
      [
        'RLS sem sessão (42501)',
        {
          code: '42501',
          message:
            'new row violates row-level security policy for table "motorista_locations"',
        },
      ],
      [
        '503 sem texto de rede',
        { code: '', message: 'invalid response from upstream server' },
      ],
    ])('%s', async (_nome, erro) => {
      semRede();
      await registrarPosicao(posicao({ latitude: 1 }), minuto(1), ROTULO);
      mockInsert.mockResolvedValue({ error: erro });

      const destino = await registrarPosicao(
        posicao({ latitude: 2 }),
        minuto(2),
        ROTULO,
      );

      expect(destino).toBe('na_fila');
      expect(filaGuardada()?.posicoes.map((p) => p.latitude)).toEqual([1, 2]);

      // E quando o banco volta a aceitar, o lote sobe como linha da tabela,
      // sem nenhum campo de controle da fila.
      mockInsert.mockClear();
      comRede();
      await registrarPosicao(posicao({ latitude: 3 }), minuto(3), ROTULO);
      expect(lotesEnviados()).toEqual([
        [
          { ...posicao({ latitude: 1 }), timestamp: iso(1) },
          { ...posicao({ latitude: 2 }), timestamp: iso(2) },
          { ...posicao({ latitude: 3 }), timestamp: iso(3) },
        ],
      ]);
      expect(filaGuardada()).toBeNull();
    });
  });

  // Posição recusada pelo servidor (rota que não é mais do motorista: foi
  // reatribuída, ou a loja foi desativada). O lote dela não pode prender o
  // das outras rotas por até MAX_TENTATIVAS_POSICAO posições.
  it('lote recusado de uma rota não prende o lote das rotas seguintes', async () => {
    const recusada = { code: '42501', message: 'posição recusada' };
    semRede();
    await registrarPosicao(posicao({ rota_id: 'antiga' }), minuto(1), ROTULO);
    await registrarPosicao(posicao({ rota_id: 'nova' }), minuto(2), ROTULO);
    mockInsert.mockClear();
    mockInsert.mockImplementation(async (linhas: Posicao[]) =>
      linhas[0].rota_id === 'antiga' ? { error: recusada } : { error: null },
    );

    await registrarPosicao(posicao({ rota_id: 'nova' }), minuto(3), ROTULO);

    expect(lotesEnviados()).toEqual([
      [{ ...posicao({ rota_id: 'antiga' }), timestamp: iso(1) }],
      [
        { ...posicao({ rota_id: 'nova' }), timestamp: iso(2) },
        { ...posicao({ rota_id: 'nova' }), timestamp: iso(3) },
      ],
    ]);
    // O lote recusado continua guardado, contando a tentativa: a mesma
    // recusa vem de uma sessão que saiu anônima, e aí ele precisa subir.
    expect(filaGuardada()?.posicoes).toEqual([
      { ...posicao({ rota_id: 'antiga' }), timestamp: iso(1), tentativas: 1 },
    ]);
  });

  it('depois de pular o lote recusado, erro de rede na rota seguinte para o envio', async () => {
    const recusada = { code: '42501', message: 'posição recusada' };
    semRede();
    await registrarPosicao(posicao({ rota_id: 'antiga' }), minuto(1), ROTULO);
    await registrarPosicao(posicao({ rota_id: 'nova' }), minuto(2), ROTULO);
    await registrarPosicao(posicao({ rota_id: 'terceira' }), minuto(3), ROTULO);
    mockInsert.mockClear();
    mockInsert.mockImplementation(async (linhas: Posicao[]) => {
      if (linhas[0].rota_id === 'antiga') return { error: recusada };
      if (linhas[0].rota_id === 'nova') return { error: ERRO_DE_REDE };
      return { error: null };
    });

    const destino = await registrarPosicao(
      posicao({ rota_id: 'terceira' }),
      minuto(4),
      ROTULO,
    );

    expect(destino).toBe('na_fila');
    // A recusada foi pulada, a nova foi tentada, e a terceira nem saiu.
    expect(lotesEnviados().map((l) => l[0].rota_id)).toEqual([
      'antiga',
      'nova',
    ]);
    expect(filaGuardada()?.posicoes).toEqual([
      { ...posicao({ rota_id: 'antiga' }), timestamp: iso(1), tentativas: 1 },
      { ...posicao({ rota_id: 'nova' }), timestamp: iso(2) },
      { ...posicao({ rota_id: 'terceira' }), timestamp: iso(3) },
      { ...posicao({ rota_id: 'terceira' }), timestamp: iso(4) },
    ]);
  });

  it('posição que esgota as tentativas sai da fila, com um logger.error por descarte', async () => {
    semRede();
    await registrarPosicao(posicao({ latitude: 0 }), minuto(0), ROTULO);
    // Erro que nunca passa e que não sabemos classificar.
    mockInsert.mockResolvedValue({
      error: { code: '42501', message: 'permission denied' },
    });

    for (let i = 1; i <= MAX_TENTATIVAS_POSICAO; i++) {
      await registrarPosicao(posicao({ latitude: i }), minuto(i), ROTULO);
    }

    // A 0 e a 1 foram tentadas MAX vezes (a 1 entrou na 1ª tentativa); as
    // seguintes ainda têm tentativas sobrando.
    const latitudes = filaGuardada()!.posicoes.map((p) => p.latitude);
    expect(latitudes[0]).toBe(2);
    expect(latitudes).toHaveLength(MAX_TENTATIVAS_POSICAO - 1);
    const descartes = (logger.error as jest.Mock).mock.calls.filter(
      ([mensagem]) => mensagem !== ROTULO,
    );
    expect(descartes).toHaveLength(1);
  });

  it('se o aparelho não consegue gravar a fila, a posição é dada como perdida', async () => {
    semRede();
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
      new Error('disco cheio'),
    );

    const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

    expect(destino).toBe('perdida');
    expect(logger.warn).toHaveBeenCalledWith(
      '[FilaPosicoes] Falha ao gravar a fila de posições',
      expect.any(Error),
    );
  });

  it('o logout apaga a fila', () => {
    expect(CHAVES_DA_CONTA).toContain(CHAVE_FILA_POSICOES);
  });

  // Sinal fraco: o insert ainda está no ar quando o logout limpa o aparelho,
  // e só depois falha por rede. A limpeza não passa pela fila em série; sem a
  // geração, `guardar` regravaria a fila com as posições da conta que saiu.
  it('insert pendurado que falha por rede depois do logout não recria a fila', async () => {
    let falhar: () => void = () => {};
    mockInsert.mockImplementation(
      () =>
        new Promise((resolve) => {
          falhar = () => resolve({ error: ERRO_DE_REDE });
        }),
    );

    const emVoo = registrarPosicao(posicao(), minuto(1), ROTULO);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInsert).toHaveBeenCalledTimes(1);

    // Logout: a limpeza invalida as posições em voo e apaga as chaves da
    // conta. O contexto, lido antes, não salva a posição: a geração a recusa.
    invalidarPosicoesEmVoo();
    memoria.delete(CHAVE_FILA_POSICOES);
    memoria.delete(CHAVE_ULTIMO_USUARIO);
    falhar();

    expect(await emVoo).toBe('perdida');
    expect(filaGuardada()).toBeNull();
  });

  // N1 + N2 da revisão: troca de conta DURANTE um envio da fila. O envio
  // começado antes do logout não pode seguir nas rodadas seguintes.
  describe('troca de conta durante o envio da fila', () => {
    /** Fila guardada de `userId` com posições nos minutos dados. */
    function guardarFila(userId: string, minutos: number[]) {
      memoria.set(
        CHAVE_FILA_POSICOES,
        JSON.stringify({
          userId,
          estourou: false,
          posicoes: minutos.map((n) => ({
            ...posicao({ motorista_id: userId }),
            timestamp: iso(n),
          })),
        }),
      );
    }

    /** O 1º insert fica no ar até `soltar()`; os seguintes sobem. */
    function primeiroInsertPendurado() {
      let soltar: () => void = () => {};
      mockInsert.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            soltar = () => resolve({ error: null });
          }),
      );
      mockInsert.mockResolvedValue({ error: null });
      return () => soltar();
    }

    it('N1: o envio da conta que saiu não apaga a fila da conta que entrou', async () => {
      guardarFila('m1', [1, 2]);
      const soltar = primeiroInsertPendurado();

      const emVoo = registrarPosicao(posicao(), minuto(3), ROTULO);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Logout de m1 e login de m2, que já guardou posição sem rede.
      invalidarPosicoesEmVoo();
      memoria.delete(CHAVE_FILA_POSICOES);
      guardarFila('m2', [10]);
      soltar();
      await emVoo;

      expect(filaGuardada()?.userId).toBe('m2');
      expect(filaGuardada()?.posicoes).toHaveLength(1);
    });

    it('N2: a mesma conta sai e entra durante o envio, e o lote não sobe de novo', async () => {
      guardarFila('m1', [1, 2]);
      const soltar = primeiroInsertPendurado();

      const emVoo = registrarPosicao(posicao(), minuto(3), ROTULO);
      await new Promise((r) => setTimeout(r, 0));
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Sai e entra de novo (a fila não foi apagada: o `remover` do envio
      // antigo é recusado pela geração e o lote continuaria lá).
      invalidarPosicoesEmVoo();
      soltar();
      await emVoo;

      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  // Corrida com o logout: a posição que estava no ar quando o motorista saiu
  // falha por rede depois da limpeza e recriaria a fila no aparelho.
  describe('só guarda com contexto de rastreamento ou sessão do motorista', () => {
    it('sem contexto nem sessão, a posição em voo não recria a fila', async () => {
      semRede();
      contextoDe(null);

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('perdida');
      expect(filaGuardada()).toBeNull();
    });

    it('contexto de outro motorista não conta', async () => {
      semRede();
      contextoDe('outra');

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('perdida');
      expect(filaGuardada()).toBeNull();
    });

    // No web o contexto de rastreamento nunca é gravado, e sem rede o
    // `lerSessao` devolve "offline" sem ler a sessão. O último usuário (que o
    // logout apaga) diz de quem é a posição.
    it('web, sem rede e sem contexto: com o último usuário igual ao motorista, guarda', async () => {
      semRede();
      contextoDe(null);
      mockLerSessao.mockResolvedValue({ session: null, offline: true });
      memoria.set(CHAVE_ULTIMO_USUARIO, 'm1');

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('na_fila');
      expect(filaGuardada()?.posicoes).toHaveLength(1);
    });

    it('depois do logout (último usuário apagado), sem rede, a fila não é recriada', async () => {
      semRede();
      contextoDe(null);
      mockLerSessao.mockResolvedValue({ session: null, offline: true });

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('perdida');
      expect(filaGuardada()).toBeNull();
    });

    it('sem rede, último usuário de outra conta não conta', async () => {
      semRede();
      contextoDe(null);
      mockLerSessao.mockResolvedValue({ session: null, offline: true });
      memoria.set(CHAVE_ULTIMO_USUARIO, 'outra');

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('perdida');
      expect(filaGuardada()).toBeNull();
    });

    it('com rede e sem sessão, o último usuário não basta (requisição anônima)', async () => {
      semRede();
      contextoDe(null);
      mockLerSessao.mockResolvedValue({ session: null, offline: false });
      memoria.set(CHAVE_ULTIMO_USUARIO, 'm1');

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('perdida');
      expect(filaGuardada()).toBeNull();
    });

    it('sem contexto, a sessão do próprio motorista basta (navegação, broadcast)', async () => {
      semRede();
      contextoDe(null);
      mockLerSessao.mockResolvedValue({
        session: { user: { id: 'm1' } },
        offline: false,
      });

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('na_fila');
      expect(filaGuardada()?.posicoes).toHaveLength(1);
    });

    it('com o contexto do motorista, guarda sem consultar a sessão', async () => {
      semRede();

      const destino = await registrarPosicao(posicao(), minuto(1), ROTULO);

      expect(destino).toBe('na_fila');
      expect(mockLerSessao).not.toHaveBeenCalled();
    });
  });

  // Medido no aparelho em 25/10/2026: logo ao abrir o app em ambiente
  // fechado, o GPS entregou `accuracy` >= 1000 m e o banco recusou a linha com
  // 22003 (as colunas eram numeric(5,2)). A Migration 60 alarga para
  // numeric(8,2); o app garante que nada passa do teto do tipo novo.
  describe('saneamento das medidas do GPS', () => {
    it('precisão ruim, mas dentro do teto, vai como veio (a posição não se perde)', async () => {
      const ruim = posicao({ precisao: 1500.5, velocidade: 12.6, heading: 90 });

      const destino = await registrarPosicao(ruim, minuto(1), ROTULO);

      expect(destino).toBe('enviada');
      expect(mockInsert).toHaveBeenCalledWith({ ...ruim, timestamp: iso(1) });
    });

    it('com rede, medida inválida sai como null no insert direto', async () => {
      await registrarPosicao(
        posicao({ velocidade: -3.6, precisao: -1, heading: -1 }),
        minuto(1),
        ROTULO,
      );

      expect(mockInsert).toHaveBeenCalledWith({
        ...posicao({ velocidade: null, precisao: null, heading: null }),
        timestamp: iso(1),
      });
    });

    it('sem rede, a fila guarda a posição já saneada', async () => {
      semRede();

      const destino = await registrarPosicao(
        posicao({ precisao: TETO_MEDIDA_POSICAO + 1, heading: 360 }),
        minuto(1),
        ROTULO,
      );

      expect(destino).toBe('na_fila');
      expect(filaGuardada()?.posicoes).toEqual([
        {
          ...posicao({ precisao: null, heading: null }),
          timestamp: iso(1),
        },
      ]);
    });

    it('lote recusado por 22003 (fora da faixa do tipo) é descartado na hora, e as outras rotas seguem', async () => {
      const ERRO_FAIXA = {
        code: '22003',
        message:
          'A field with precision 5, scale 2 must round to an absolute value less than 10^3.',
      };
      semRede();
      await registrarPosicao(posicao({ rota_id: 'estreita' }), minuto(1), ROTULO);
      await registrarPosicao(posicao({ rota_id: 'viva' }), minuto(2), ROTULO);
      mockInsert.mockClear();
      mockInsert.mockImplementation(async (linhas: Posicao[]) =>
        linhas[0].rota_id === 'estreita'
          ? { error: ERRO_FAIXA }
          : { error: null },
      );

      await registrarPosicao(posicao({ rota_id: 'viva' }), minuto(3), ROTULO);

      expect(lotesEnviados().map((l) => l.length)).toEqual([1, 2]);
      // Não fica contando tentativas: reenviar daria sempre o mesmo erro.
      expect(filaGuardada()).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '[FilaPosicoes] Banco recusou posições guardadas; descartadas',
        expect.objectContaining({ rota_id: 'estreita', quantidade: 1 }),
      );
    });
  });
});

describe('sanearPosicao', () => {
  it('o teto é o maior valor de numeric(8,2)', () => {
    expect(TETO_MEDIDA_POSICAO).toBe(999999.99);
  });

  it('valores válidos passam intactos, inclusive nos limites', () => {
    const p = posicao({ velocidade: 0, precisao: 0, heading: 0 });
    expect(sanearPosicao(p)).toEqual(p);
    const limites = posicao({
      velocidade: TETO_MEDIDA_POSICAO,
      precisao: TETO_MEDIDA_POSICAO,
      heading: 359.99,
    });
    expect(sanearPosicao(limites)).toEqual(limites);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('%s vira null nos três campos', (_nome, valor) => {
    expect(
      sanearPosicao(
        posicao({ velocidade: valor, precisao: valor, heading: valor }),
      ),
    ).toEqual(posicao({ velocidade: null, precisao: null, heading: null }));
  });

  it('negativos viram null (o iOS manda -1 para "inválido")', () => {
    expect(
      sanearPosicao(posicao({ velocidade: -3.6, precisao: -1, heading: -1 })),
    ).toEqual(posicao({ velocidade: null, precisao: null, heading: null }));
  });

  it('heading fora de [0, 360) vira null', () => {
    expect(sanearPosicao(posicao({ heading: 360 })).heading).toBeNull();
    expect(sanearPosicao(posicao({ heading: 720 })).heading).toBeNull();
  });

  it('acima do teto vira null, em vez de virar o teto (seria uma medida falsa)', () => {
    expect(
      sanearPosicao(
        posicao({
          velocidade: TETO_MEDIDA_POSICAO + 0.01,
          precisao: 1e7,
        }),
      ),
    ).toEqual(posicao({ velocidade: null, precisao: null }));
  });

  it('null continua null, e o resto da linha não muda', () => {
    const p = posicao({ fonte: 'background', velocidade: null, heading: null });
    expect(sanearPosicao(p)).toEqual(p);
  });

  it('não altera o objeto recebido', () => {
    const p = posicao({ precisao: -1 });
    sanearPosicao(p);
    expect(p.precisao).toBe(-1);
  });
});
