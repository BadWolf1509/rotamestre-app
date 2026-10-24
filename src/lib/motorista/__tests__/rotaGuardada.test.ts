import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';

import {
  CHAVE_ROTA_GUARDADA,
  gravarRotaGuardada,
  lerRotaGuardada,
} from '../rotaGuardada';

jest.mock('@/lib/logger');

const memoria = new Map<string, string>();

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
});

const rota: RouteData = {
  id: 'r1',
  unidade_id: 'u1',
  status: 'em_andamento',
  unidade_nome: 'Loja',
};

const paradas: ParadaData[] = [
  {
    id: 'p1',
    endereco: 'Rua 1',
    ordem: 1,
    status: 'pendente',
    tipo: 'entrega',
    latitude: -7.1,
    longitude: -34.8,
  },
];

describe('rota guardada (stale-if-error, por conta)', () => {
  it('devolve o retrato gravado para a mesma conta, com a hora da gravação', async () => {
    await gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 2,
      guardadoEm: 1_700_000_000_000,
    });

    await expect(lerRotaGuardada('m1')).resolves.toEqual({
      route: rota,
      paradas,
      pendingRoutesCount: 2,
      guardadoEm: 1_700_000_000_000,
    });
  });

  it('retrato de outra conta não responde por esta', async () => {
    await gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 0,
      guardadoEm: 1,
    });

    await expect(lerRotaGuardada('m2')).resolves.toBeNull();
  });

  it('sem retrato: null', async () => {
    await expect(lerRotaGuardada('m1')).resolves.toBeNull();
  });

  it('gravação nova substitui a anterior (uma vaga só)', async () => {
    await gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 0,
      guardadoEm: 1,
    });
    await gravarRotaGuardada('m1', {
      route: null,
      paradas: [],
      pendingRoutesCount: 0,
      guardadoEm: 2,
    });

    await expect(lerRotaGuardada('m1')).resolves.toEqual({
      route: null,
      paradas: [],
      pendingRoutesCount: 0,
      guardadoEm: 2,
    });
    expect(memoria.size).toBe(1);
  });

  it('não expira por tempo: um retrato antigo ainda é devolvido', async () => {
    const antigo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    await gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 0,
      guardadoEm: antigo,
    });

    const lido = await lerRotaGuardada('m1');
    expect(lido?.guardadoEm).toBe(antigo);
  });

  it('conteúdo corrompido: null e aviso, sem lançar', async () => {
    memoria.set(CHAVE_ROTA_GUARDADA, '{nao é json');

    await expect(lerRotaGuardada('m1')).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falha ao gravar não lança (só avisa)', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('disco cheio'),
    );

    await expect(
      gravarRotaGuardada('m1', {
        route: rota,
        paradas,
        pendingRoutesCount: 0,
        guardadoEm: 1,
      }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
