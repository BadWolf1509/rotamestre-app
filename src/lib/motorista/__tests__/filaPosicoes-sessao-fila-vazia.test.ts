/**
 * OFF-5: com a fila vazia, a posição recusada por sessão (sem sessão, token
 * vencido, 401) ia para lugar nenhum. A mesma recusa, com a fila cheia, guarda
 * o lote e conta tentativa — agora a posição solitária segue a mesma regra, já
 * com a tentativa contada. Recusa de DADO (#658) e 42501 (RLS real, gatilho
 * da conferência da rota) continuam perdidas na hora.
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

const posicao: Posicao = {
  motorista_id: 'm1',
  rota_id: 'rota-a',
  latitude: -7.1,
  longitude: -34.8,
  velocidade: null,
  precisao: 10,
  heading: null,
};
const CAPTURA = Date.UTC(2026, 9, 25, 12, 1);

function filaGuardada() {
  const bruto = memoria.get(CHAVE_FILA);
  return bruto ? JSON.parse(bruto) : null;
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
  // Contexto de rastreamento do motorista: a posição é deste aparelho.
  memoria.set(
    '@rotamestre:tracking_context',
    JSON.stringify({
      rotaId: 'rota-a',
      motoristaId: 'm1',
      motoristaNome: 'Motorista',
      startedAt: '2026-10-25T12:00:00Z',
    }),
  );
});

describe('recusa de sessão com fila vazia vai para a fila', () => {
  it.each([
    ['PGRST301 (sem sessão, porteiro do fetch)', { code: 'PGRST301' }],
    ['PGRST303 (JWT vencido)', { code: 'PGRST303' }],
    ['status 401 sem código', { status: 401, message: 'Unauthorized' }],
  ])('%s', async (_nome, erro) => {
    mockInsert.mockResolvedValue({ error: erro });

    const destino = await registrarPosicao(posicao, CAPTURA, ROTULO);

    expect(destino).toBe('na_fila');
    expect(filaGuardada()?.posicoes).toEqual([
      {
        ...posicao,
        timestamp: new Date(CAPTURA).toISOString(),
        tentativas: 1,
      },
    ]);
  });
});

it('42501 com fila vazia continua perdida (é o gatilho de conferir a rota)', async () => {
  // Com o porteiro, sem sessão já volta PGRST301; o 42501 que sobra é recusa
  // real da RLS (rota encerrada ou reatribuída), e o 'perdida' é o que faz o
  // rastreamento conferir a rota.
  mockInsert.mockResolvedValue({
    error: { code: '42501', message: 'row-level security' },
  });

  const destino = await registrarPosicao(posicao, CAPTURA, ROTULO);

  expect(destino).toBe('perdida');
  expect(filaGuardada()).toBeNull();
});

it('recusa de dado com fila vazia continua perdida', async () => {
  mockInsert.mockResolvedValue({
    error: { code: '22003', message: 'numeric field overflow' },
  });

  const destino = await registrarPosicao(posicao, CAPTURA, ROTULO);

  expect(destino).toBe('perdida');
  expect(filaGuardada()).toBeNull();
});

it('5xx sem texto de rede com fila vazia continua perdida (não é sessão)', async () => {
  mockInsert.mockResolvedValue({
    error: { code: '', message: 'invalid response from upstream server' },
  });

  const destino = await registrarPosicao(posicao, CAPTURA, ROTULO);

  expect(destino).toBe('perdida');
  expect(filaGuardada()).toBeNull();
});
