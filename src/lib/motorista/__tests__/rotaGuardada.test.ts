import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';

import { criarAcaoParada } from '../filaAcoesParada';
import {
  aplicarAcoesNaRotaGuardada,
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

describe('ação que subiu entra no retrato (Minor 3 da revisão final)', () => {
  const conclusao = (motoristaId = 'm1', rotaId = 'r1') =>
    criarAcaoParada({
      tipo: 'concluir',
      paradaId: 'p1',
      rotaId,
      motoristaId,
      em: '2026-10-24T12:00:00.000Z',
    });

  async function guardar() {
    await gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 0,
      guardadoEm: 1_700_000_000_000,
    });
  }

  it('marca a parada concluída e mantém a hora do retrato', async () => {
    await guardar();

    await aplicarAcoesNaRotaGuardada('m1', [conclusao()]);

    const lido = await lerRotaGuardada('m1');
    expect(lido?.paradas[0].status).toBe('concluida');
    expect(lido?.paradas[0].concluida_em).toBe('2026-10-24T12:00:00.000Z');
    expect(lido?.guardadoEm).toBe(1_700_000_000_000);
  });

  it('não mexe no retrato de outra conta nem em ação de outra rota', async () => {
    await guardar();

    await aplicarAcoesNaRotaGuardada('m2', [conclusao('m2')]);
    await aplicarAcoesNaRotaGuardada('m1', [conclusao('m1', 'outra-rota')]);

    expect((await lerRotaGuardada('m1'))?.paradas[0].status).toBe('pendente');
  });

  it('em série: um retrato fresco gravado depois não é sobrescrito pela correção', async () => {
    await guardar();
    // Leitura lenta: sem a série, a gravação fresca cairia no meio da
    // correção, e a correção a sobrescreveria com o retrato velho.
    let leu: () => void = () => undefined;
    const leitura = new Promise<void>((ok) => (leu = ok));
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce((k: string) => {
      const valor = memoria.get(k) ?? null;
      leu();
      return new Promise((ok) => setTimeout(() => ok(valor), 10));
    });

    const correcao = aplicarAcoesNaRotaGuardada('m1', [conclusao()]);
    await leitura;
    const fresco = gravarRotaGuardada('m1', {
      route: rota,
      paradas,
      pendingRoutesCount: 0,
      guardadoEm: 2,
    });
    await Promise.all([correcao, fresco]);

    expect((await lerRotaGuardada('m1'))?.guardadoEm).toBe(2);
  });
});
