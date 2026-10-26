/**
 * O que a conta ainda tem no aparelho sem ter chegado ao banco, para o "Sair"
 * avisar antes: as ações e fotos ficam guardadas e só sobem quando a MESMA
 * conta entrar de novo NESTE aparelho; as posições são apagadas no logout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  contarPendenciasDaConta,
  mensagemDeSaida,
} from '../pendenciasDoAparelho';

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

const mockFotos = jest.fn();
jest.mock('@/lib/offline', () => ({
  getPendingPhotosCount: () => mockFotos(),
}));

const mapa = (AsyncStorage as unknown as { __mapa: Map<string, string> })
  .__mapa;

const acao = (id: string, motoristaId: string) => ({
  id,
  tipo: 'concluir',
  paradaId: `p-${id}`,
  rotaId: 'r1',
  motoristaId,
  em: '2026-10-26T12:00:00.000Z',
  tentativas: 0,
});

beforeEach(() => {
  mapa.clear();
  mockFotos.mockResolvedValue(0);
});

describe('contarPendenciasDaConta', () => {
  it('conta só as ações e as posições da conta, e as fotos do dono', async () => {
    mapa.set(
      '@rotamestre:fila_acoes_parada',
      JSON.stringify([acao('a', 'm1'), acao('b', 'm1'), acao('c', 'outra')]),
    );
    mapa.set(
      '@rotamestre:fila_posicoes',
      JSON.stringify({
        userId: 'm1',
        posicoes: [{ rota_id: 'r1' }, { rota_id: 'r1' }, { rota_id: 'r1' }],
        estourou: false,
      }),
    );
    mockFotos.mockResolvedValue(1);

    await expect(contarPendenciasDaConta('m1')).resolves.toEqual({
      acoes: 2,
      fotos: 1,
      posicoes: 3,
    });
  });

  it('fila de posições de outra conta não conta; leitura que falha vira zero', async () => {
    mapa.set(
      '@rotamestre:fila_posicoes',
      JSON.stringify({ userId: 'outra', posicoes: [{}], estourou: false }),
    );
    mockFotos.mockRejectedValue(new Error('índice ilegível'));

    await expect(contarPendenciasDaConta('m1')).resolves.toEqual({
      acoes: 0,
      fotos: 0,
      posicoes: 0,
    });
  });
});

describe('mensagemDeSaida', () => {
  it('sem pendência: a pergunta de sempre', () => {
    expect(mensagemDeSaida({ acoes: 0, fotos: 0, posicoes: 0 })).toBe(
      'Deseja realmente encerrar sua sessão?',
    );
  });

  it('com entregas e fotos: diz quantas e quando sobem', () => {
    const m = mensagemDeSaida({ acoes: 2, fotos: 1, posicoes: 0 });
    expect(m).toContain('2 registros de parada');
    expect(m).toContain('1 foto');
    expect(m).toContain('quando você entrar de novo neste aparelho');
  });

  it('só posições: avisa que o trajeto sem sinal se perde', () => {
    const m = mensagemDeSaida({ acoes: 0, fotos: 0, posicoes: 5 });
    expect(m).toContain('trajeto');
    expect(m).not.toContain('quando você entrar de novo');
  });
});
