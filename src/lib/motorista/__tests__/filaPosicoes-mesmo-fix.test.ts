/**
 * O MESMO fix do GPS chega a `registrarPosicao` mais de uma vez: a task de
 * segundo plano, o hook de transmissão e a navegação assinam o GPS cada um
 * por conta própria, e o Android entrega o mesmo `Location` (mesmo horário,
 * mesma coordenada) a todos. Medido em produção (rota demo 4c9eaaae, 27/10, e
 * rota b782357f, 30/10): cópias em transações consecutivas, de `fonte`
 * diferente (foreground + background) ou da mesma, e — depois de um período
 * sem rede — as duas cópias DENTRO do mesmo lote (mesmo xmin), porque as duas
 * entraram na fila. Não era o mesmo lote enviado duas vezes: o envio já é de
 * voo único (ver "duas posições quase juntas" em `filaPosicoes.test.ts`).
 *
 * A porta única passa a reconhecer o fix já registrado e não o grava de novo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  invalidarPosicoesEmVoo,
  registrarPosicao,
  type Posicao,
} from '../filaPosicoes';

jest.mock('@/lib/logger');

const mockInsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (linhas: unknown) => mockInsert(linhas) }),
  },
}));

jest.mock('@/lib/auth/sessao', () => ({
  lerSessao: async () => ({ session: null, offline: false }),
}));

const memoria = new Map<string, string>();
const CHAVE_FILA = '@rotamestre:fila_posicoes';
const ERRO_DE_REDE = { message: 'TypeError: Network request failed' };

function fix(extra: Partial<Posicao> = {}): Posicao {
  return {
    motorista_id: 'm1',
    rota_id: 'rota-a',
    latitude: -7.0555349,
    longitude: -34.8522001,
    velocidade: 0.13,
    precisao: 5.14,
    heading: 0,
    ...extra,
  };
}

const minuto = (n: number) => Date.UTC(2026, 9, 27, 0, n);
const iso = (n: number) => new Date(minuto(n)).toISOString();

function filaGuardada(): { posicoes: Array<{ timestamp: string }> } | null {
  const bruto = memoria.get(CHAVE_FILA);
  return bruto ? JSON.parse(bruto) : null;
}

/** Todas as linhas que foram ao banco, de todos os inserts. */
function linhasEnviadas(): Array<Record<string, unknown>> {
  return mockInsert.mock.calls.flatMap(([linhas]) =>
    Array.isArray(linhas) ? linhas : [linhas],
  );
}

const comHorario = (n: number) =>
  linhasEnviadas().filter((l) => l.timestamp === iso(n));

beforeEach(() => {
  jest.clearAllMocks();
  memoria.clear();
  invalidarPosicoesEmVoo();
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
  memoria.set(
    '@rotamestre:tracking_context',
    JSON.stringify({
      rotaId: 'rota-a',
      motoristaId: 'm1',
      motoristaNome: 'Motorista',
      startedAt: '2026-10-27T00:00:00Z',
    }),
  );
  mockInsert.mockResolvedValue({ error: null });
});

describe('o mesmo fix do GPS vai ao banco uma vez só', () => {
  it('com rede, task e hook registrando o mesmo fix ao mesmo tempo', async () => {
    const [daTask, doHook] = await Promise.all([
      registrarPosicao(fix({ fonte: 'background' }), minuto(1), 'task'),
      registrarPosicao(fix({ fonte: 'foreground' }), minuto(1), 'hook'),
    ]);

    expect(comHorario(1)).toHaveLength(1);
    // Quem chegou depois não perdeu nada: o fix dele já está no banco.
    expect(daTask).toBe('enviada');
    expect(doHook).toBe('enviada');
  });

  it('com rede, o mesmo fix entregue de novo depois do primeiro envio', async () => {
    await registrarPosicao(fix({ fonte: 'background' }), minuto(1), 'task');
    const deNovo = await registrarPosicao(
      fix({ fonte: 'background' }),
      minuto(1),
      'task',
    );

    expect(comHorario(1)).toHaveLength(1);
    expect(deNovo).toBe('enviada');
  });

  it('sem rede, o mesmo fix de dois chamadores entra na fila uma vez, e a reconexão sobe um só', async () => {
    mockInsert.mockResolvedValue({ error: ERRO_DE_REDE });
    await Promise.all([
      registrarPosicao(fix({ fonte: 'background' }), minuto(1), 'task'),
      registrarPosicao(fix({ fonte: 'foreground' }), minuto(1), 'hook'),
    ]);
    // Re-entrega do mesmo fix, já com a fila de pé (ramo "fila com algo").
    await registrarPosicao(fix({ fonte: 'background' }), minuto(1), 'task');

    expect(filaGuardada()?.posicoes).toHaveLength(1);

    mockInsert.mockClear();
    mockInsert.mockResolvedValue({ error: null });
    await registrarPosicao(fix({ latitude: -7.06 }), minuto(2), 'task');

    expect(comHorario(1)).toHaveLength(1);
    expect(comHorario(2)).toHaveLength(1);
    expect(filaGuardada()).toBeNull();
  });

  it('fila que já tem o mesmo fix duas vezes (gravada pela 1.14.10) sobe sem a cópia', async () => {
    const linha = { ...fix(), timestamp: iso(1) };
    memoria.set(
      CHAVE_FILA,
      JSON.stringify({
        userId: 'm1',
        posicoes: [linha, { ...linha, fonte: 'foreground' }],
        estourou: false,
      }),
    );

    await registrarPosicao(fix({ latitude: -7.06 }), minuto(2), 'task');

    expect(comHorario(1)).toHaveLength(1);
    expect(filaGuardada()).toBeNull();
  });

  it('sem rede, fix que outro contexto JS (task headless) já guardou não entra de novo', async () => {
    // A memória do fix único é do contexto; a fila no AsyncStorage é a única
    // coisa que os dois contextos compartilham.
    memoria.set(
      CHAVE_FILA,
      JSON.stringify({
        userId: 'm1',
        posicoes: [{ ...fix({ fonte: 'background' }), timestamp: iso(1) }],
        estourou: false,
      }),
    );
    mockInsert.mockResolvedValue({ error: ERRO_DE_REDE });

    const destino = await registrarPosicao(
      fix({ fonte: 'foreground' }),
      minuto(1),
      'hook',
    );

    expect(destino).toBe('na_fila');
    expect(filaGuardada()?.posicoes).toHaveLength(1);
  });

  it('fix perdido não impede a próxima entrega do mesmo fix de tentar', async () => {
    mockInsert.mockResolvedValueOnce({
      error: { code: '22003', message: 'numeric field overflow' },
    });
    const primeira = await registrarPosicao(fix(), minuto(1), 'task');
    const segunda = await registrarPosicao(fix(), minuto(1), 'hook');

    expect(primeira).toBe('perdida');
    expect(segunda).toBe('enviada');
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('fixes diferentes no mesmo horário (outra rota, outra coordenada) não são confundidos', async () => {
    await registrarPosicao(fix(), minuto(1), 'task');
    await registrarPosicao(fix({ rota_id: 'rota-b' }), minuto(1), 'task');
    await registrarPosicao(fix({ latitude: -7.2 }), minuto(1), 'task');

    expect(comHorario(1)).toHaveLength(3);
  });
});
