/**
 * O banco recusa com 42501 posição de rota fora de `em_andamento` (aceita a
 * rota concluída só até 10 min depois de `concluida_em`). O lote de uma rota
 * vai inteiro e em ordem de tempo; o que mistura posições dentro e além da
 * margem era recusado inteiro e, depois de MAX_TENTATIVAS_POSICAO, a trilha
 * legítima do fim da rota ia junto. Agora o lote recusado com 42501 é partido:
 * a parte aceita sobe, e só a cauda além da margem fica contando tentativa.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { registrarPosicao, type Posicao } from '../filaPosicoes';

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
const ROTULO = '[Teste] Erro ao salvar';

const ERRO_DE_REDE = { message: 'TypeError: Network request failed' };
const FORA_DA_MARGEM = {
  code: '42501',
  message:
    'new row violates row-level security policy for table "motorista_locations"',
};

type Linha = Posicao & { timestamp: string };
type Guardada = Linha & { tentativas?: number };

function posicao(rota: string, n: number): Posicao {
  return {
    motorista_id: 'm1',
    rota_id: rota,
    latitude: n,
    longitude: -34.8,
    velocidade: null,
    precisao: 10,
    heading: null,
  };
}

/** Horário de captura (epoch ms): minuto n. */
const minuto = (n: number) => Date.UTC(2026, 9, 25, 12, n);
const iso = (n: number) => new Date(minuto(n)).toISOString();

function filaGuardada(): Guardada[] {
  const bruto = memoria.get(CHAVE_FILA);
  return bruto ? JSON.parse(bruto).posicoes : [];
}

/** Linhas de cada chamada de insert, sempre como lista. */
function lotesEnviados(): Linha[][] {
  return mockInsert.mock.calls.map(([linhas]) =>
    Array.isArray(linhas) ? linhas : [linhas],
  );
}

/** Guarda as posições sem rede, na ordem dada. */
async function guardarSemRede(posicoes: Array<[string, number]>) {
  mockInsert.mockResolvedValue({ error: ERRO_DE_REDE });
  for (const [rota, n] of posicoes) {
    await registrarPosicao(posicao(rota, n), minuto(n), ROTULO);
  }
  mockInsert.mockClear();
}

/**
 * Banco com a rota R concluída: aceita o lote de R só se todas as posições
 * forem até o minuto `ate`; o de outra rota, sempre.
 */
function bancoComMargem(ate: number) {
  mockInsert.mockImplementation(async (linhas: Linha | Linha[]) => {
    const lote = Array.isArray(linhas) ? linhas : [linhas];
    const alemDaMargem = lote.some(
      (l) => l.rota_id === 'R' && Date.parse(l.timestamp) > minuto(ate),
    );
    return { error: alemDaMargem ? FORA_DA_MARGEM : null };
  });
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
  memoria.set(
    '@rotamestre:tracking_context',
    JSON.stringify({
      rotaId: 'R',
      motoristaId: 'm1',
      motoristaNome: 'Motorista',
      startedAt: '2026-10-25T12:00:00Z',
    }),
  );
});

it('lote recusado com 42501 sobe o prefixo aceito', async () => {
  // 7 guardadas sem rede; a 8ª chega com a rede de volta e entra no lote.
  await guardarSemRede([1, 2, 3, 4, 5, 6, 7].map((n) => ['R', n]));
  bancoComMargem(5);

  const destino = await registrarPosicao(posicao('R', 8), minuto(8), ROTULO);

  expect(destino).toBe('na_fila');
  const inseridas = lotesEnviados()
    .filter((lote) => lote.every((l) => Date.parse(l.timestamp) <= minuto(5)))
    .flat()
    .map((l) => l.latitude);
  expect(inseridas).toEqual([1, 2, 3, 4, 5]);
  expect(filaGuardada()).toEqual(
    [6, 7, 8].map((n) => ({
      ...posicao('R', n),
      timestamp: iso(n),
      tentativas: 1,
    })),
  );
  // A linha que vai ao banco nunca leva o controle da fila.
  lotesEnviados()
    .flat()
    .forEach((l) => expect(l).not.toHaveProperty('tentativas'));
});

it('recusa de sessão não parte o lote', async () => {
  await guardarSemRede([1, 2, 3].map((n) => ['R', n]));
  mockInsert.mockResolvedValue({
    error: { code: 'PGRST301', message: 'JWT expired' },
  });

  const destino = await registrarPosicao(posicao('R', 4), minuto(4), ROTULO);

  expect(destino).toBe('na_fila');
  expect(lotesEnviados().map((l) => l.length)).toEqual([4]);
  expect(filaGuardada().map((p) => p.tentativas)).toEqual([1, 1, 1, 1]);
});

it('outra rota não é afetada pela partição', async () => {
  await guardarSemRede([
    ['R', 1],
    ['R', 2],
    ['R', 3],
    ['R', 4],
    ['S', 5],
    ['S', 6],
  ]);
  bancoComMargem(2);

  await registrarPosicao(posicao('S', 7), minuto(7), ROTULO);

  const lotesDeS = lotesEnviados().filter((l) => l[0].rota_id === 'S');
  expect(lotesDeS.map((l) => l.map((p) => p.latitude))).toEqual([[5, 6, 7]]);
  expect(
    filaGuardada().map((p) => [p.rota_id, p.latitude, p.tentativas]),
  ).toEqual([
    ['R', 3, 1],
    ['R', 4, 1],
  ]);
});
