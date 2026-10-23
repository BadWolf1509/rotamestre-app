/**
 * Concluir/pular sem rede: a ação vai para a fila em vez de falhar.
 * O banco é a porta em memória (`criarBancoFake`), com as regras do servidor.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { getErrorMessage } from '@/lib/errorMapping';
import {
  _resetFilaAcoesParada,
  enfileirarAcaoParada,
  criarAcaoParada,
  lerFilaAcoesParada,
  type PortaParadas,
} from '@/lib/motorista/filaAcoesParada';

import { useRouteActions } from '../useRouteActions';

jest.mock('@/lib/supabase');
jest.mock('@/services/unifiedLocationTracking');
jest.mock('@/lib/logger');
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

function criarBancoFake() {
  const status: Record<string, string> = { p1: 'em_andamento', p2: 'pendente' };
  let falha: unknown = null;
  const porta: PortaParadas = {
    async lerParada(id) {
      if (falha) throw falha;
      if (!status[id]) return null;
      return {
        status: status[id],
        rota_id: 'route-1',
        rota: { status: 'em_andamento', motorista_id: 'user-1' },
      };
    },
    async atualizarSeAberta(id, dados) {
      if (falha) throw falha;
      if (status[id] !== 'pendente' && status[id] !== 'em_andamento')
        return false;
      status[id] = dados.status as string;
      return true;
    },
    async avancarProxima() {
      if (falha) throw falha;
    },
  };
  return {
    porta,
    status,
    falharCom(e: unknown) {
      falha = e;
    },
  };
}

const route: RouteData = {
  id: 'route-1',
  unidade_id: 'unit-1',
  status: 'em_andamento',
  unidade_nome: 'Unidade A',
};
const paradas: ParadaData[] = [
  {
    id: 'p1',
    endereco: 'Rua A',
    ordem: 1,
    status: 'em_andamento',
    tipo: 'entrega',
    latitude: 0,
    longitude: 0,
  },
];

function setup(porta: PortaParadas, ps: ParadaData[] = paradas) {
  const loadActiveRoute = jest.fn().mockResolvedValue(undefined);
  // eslint-disable-next-line react-hooks/rules-of-hooks -- não usa estado do React
  const actions = useRouteActions({
    route,
    paradas: ps,
    userData: { id: 'user-1', nome: 'Joao' },
    loadActiveRoute,
    portaParadas: porta,
  });
  return { ...actions, loadActiveRoute };
}

function ficarOffline() {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
}

beforeEach(() => {
  (AsyncStorage as unknown as { __mapa: Map<string, string> }).__mapa.clear();
  _resetFilaAcoesParada();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

describe('completeStop sem rede', () => {
  it('offline: não lança, devolve "na_fila" e guarda a ação com o dono da rota', async () => {
    ficarOffline();
    const banco = criarBancoFake();
    const { completeStop } = setup(banco.porta);

    await expect(completeStop('p1')).resolves.toBe('na_fila');

    const fila = await lerFilaAcoesParada();
    expect(fila).toEqual([
      expect.objectContaining({
        tipo: 'concluir',
        paradaId: 'p1',
        rotaId: 'route-1',
        motoristaId: 'user-1',
      }),
    ]);
    expect(banco.status.p1).toBe('em_andamento');
  });

  it('rede caiu no meio do envio: vai para a fila em vez de mostrar erro', async () => {
    const banco = criarBancoFake();
    banco.falharCom(new TypeError('Network request failed'));
    const { completeStop } = setup(banco.porta);

    await expect(completeStop('p1')).resolves.toBe('na_fila');
    expect(await lerFilaAcoesParada()).toHaveLength(1);
  });

  it('online: conclui direto e devolve "enviada"', async () => {
    const banco = criarBancoFake();
    const { completeStop, loadActiveRoute } = setup(banco.porta);
    await expect(completeStop('p1')).resolves.toBe('enviada');
    expect(banco.status.p1).toBe('concluida');
    expect(await lerFilaAcoesParada()).toEqual([]);
    expect(loadActiveRoute).toHaveBeenCalled();
  });

  it('online com parada removida pelo gestor: erro com mensagem útil, nada na fila', async () => {
    const banco = criarBancoFake();
    delete banco.status.p1;
    const { completeStop } = setup(banco.porta);
    const erro = await completeStop('p1').catch((e) => e);
    expect(getErrorMessage(erro).code).toBe('STOP_UNAVAILABLE');
    expect(await lerFilaAcoesParada()).toEqual([]);
  });

  it('erro do servidor (não de rede) continua aparecendo, sem ir para a fila', async () => {
    const banco = criarBancoFake();
    banco.falharCom({ message: 'permission denied', code: '42501' });
    const { completeStop } = setup(banco.porta);
    await expect(completeStop('p1')).rejects.toBeTruthy();
    expect(await lerFilaAcoesParada()).toEqual([]);
  });
});

describe('skipStop sem rede', () => {
  it('offline: guarda motivo e observações na fila', async () => {
    ficarOffline();
    const banco = criarBancoFake();
    const { skipStop } = setup(banco.porta);

    await expect(skipStop('p1', 'cliente_ausente', 'tocou 3x')).resolves.toBe(
      'na_fila',
    );
    expect(await lerFilaAcoesParada()).toEqual([
      expect.objectContaining({
        tipo: 'pular',
        motivo: 'cliente_ausente',
        observacoes: 'tocou 3x',
      }),
    ]);
  });
});

describe('completeRoute com envios pendentes', () => {
  it('recusa finalizar enquanto há conclusão desta rota na fila, com mensagem útil', async () => {
    const banco = criarBancoFake();
    await enfileirarAcaoParada(
      criarAcaoParada({
        tipo: 'concluir',
        paradaId: 'p1',
        rotaId: 'route-1',
        motoristaId: 'user-1',
        em: '2026-10-23T12:00:00.000Z',
      }),
    );
    // A tela já mostra a parada concluída (sobreposição da fila).
    const { completeRoute } = setup(banco.porta, [
      { ...paradas[0], status: 'concluida' },
    ]);
    const erro = await completeRoute().catch((e) => e);
    expect(getErrorMessage(erro).code).toBe('ROUTE_SENDS_PENDING');
  });
});
