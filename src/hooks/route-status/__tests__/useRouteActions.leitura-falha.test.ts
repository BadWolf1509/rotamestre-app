/**
 * Sem rede e com a fila de ações ilegível no aparelho (OFF-4): concluir NÃO
 * pode responder "na_fila" — a ação não ficou guardada. O erro chega à tela
 * como "Não ficou salvo", para o motorista tentar de novo.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import { getErrorMessage } from '@/lib/errorMapping';
import {
  _resetFilaAcoesParada,
  type PortaParadas,
} from '@/lib/motorista/filaAcoesParada';

import { useRouteActions } from '../useRouteActions';

jest.mock('@/lib/offline', () => ({
  ...jest.requireActual('@/lib/offline'),
  solicitarEnvioFila: jest.fn(),
}));
jest.mock('@/lib/supabase');
jest.mock('@/services/unifiedLocationTracking');
jest.mock('@/lib/logger');

const CHAVE_FILA = '@rotamestre:fila_acoes_parada';

const porta: PortaParadas = {
  lerParada: jest.fn(),
  atualizarSeAberta: jest.fn(),
  avancarProxima: jest.fn(),
};

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

beforeEach(() => {
  jest.clearAllMocks();
  _resetFilaAcoesParada();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => {
    if (k === CHAVE_FILA) throw new Error('CursorWindow cheio');
    return null;
  });
});

it('offline com a fila ilegível: completeStop rejeita com "Não ficou salvo"', async () => {
  const { completeStop } = useRouteActions({
    route,
    paradas,
    userData: { id: 'user-1', nome: 'Joao' },
    loadActiveRoute: jest.fn().mockResolvedValue(undefined),
    portaParadas: porta,
  });

  const erro = await completeStop('p1').then(
    (destino) => destino,
    (e: unknown) => e,
  );

  expect(erro).not.toBe('na_fila');
  expect(getErrorMessage(erro).title).toBe('Não ficou salvo');
  expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
    CHAVE_FILA,
    expect.anything(),
  );
});
