import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/lib/logger';

import {
  CHAVE_CONTEXTO_RASTREAMENTO,
  motoristaDoContexto,
} from '../contextoRastreamento';

jest.mock('@/lib/logger');

const getItem = AsyncStorage.getItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('motoristaDoContexto', () => {
  it('lê da chave do contexto e devolve o motorista gravado', async () => {
    getItem.mockResolvedValue(
      JSON.stringify({ rotaId: 'r1', motoristaId: 'm1' }),
    );

    await expect(motoristaDoContexto()).resolves.toBe('m1');
    expect(getItem).toHaveBeenCalledWith(CHAVE_CONTEXTO_RASTREAMENTO);
  });

  it('a chave é a que o logout e a limpeza de cache conhecem', () => {
    expect(CHAVE_CONTEXTO_RASTREAMENTO).toBe('@rotamestre:tracking_context');
  });

  it('sem contexto gravado devolve null, sem avisar', async () => {
    getItem.mockResolvedValue(null);

    await expect(motoristaDoContexto()).resolves.toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([
    ['sem motoristaId', { rotaId: 'r1' }],
    ['motoristaId numérico', { motoristaId: 42 }],
    ['motoristaId nulo', { motoristaId: null }],
  ])('contexto %s devolve null', async (_nome, contexto) => {
    getItem.mockResolvedValue(JSON.stringify(contexto));

    await expect(motoristaDoContexto()).resolves.toBeNull();
  });

  it('JSON ilegível devolve null e registra o aviso', async () => {
    getItem.mockResolvedValue('{quebrado');

    await expect(motoristaDoContexto()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '[ContextoRastreamento] Falha ao ler o contexto',
      expect.any(SyntaxError),
    );
  });

  it('falha do storage devolve null e registra o aviso', async () => {
    const erro = new Error('disco');
    getItem.mockRejectedValue(erro);

    await expect(motoristaDoContexto()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      '[ContextoRastreamento] Falha ao ler o contexto',
      erro,
    );
  });
});
