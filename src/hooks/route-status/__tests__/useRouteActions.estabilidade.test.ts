/**
 * Identidade das ações do contexto de rota: o valor do contexto só pode mudar
 * quando os dados mudam, senão toda tela que o consome re-renderiza à toa.
 * O banco é a porta em memória; o aparelho está "online".
 */
import { renderHook } from '@testing-library/react-native';

import type { ParadaData, RouteData } from '@/context/route-status/types';
import type { PortaParadas } from '@/lib/motorista/filaAcoesParada';

import { useRouteActions } from '../useRouteActions';

jest.mock('@/lib/supabase');
jest.mock('@/services/unifiedLocationTracking');
jest.mock('@/lib/logger');
jest.mock('@/lib/offline', () => ({
  ...jest.requireActual('@/lib/offline'),
  isOnline: jest.fn().mockResolvedValue(true),
  solicitarEnvioFila: jest.fn().mockResolvedValue(undefined),
}));

const porta: PortaParadas = {
  lerParada: jest.fn().mockResolvedValue({
    status: 'em_andamento',
    rota_id: 'route-1',
    rota: { status: 'em_andamento', motorista_id: 'm1' },
  }),
  atualizarSeAberta: jest.fn().mockResolvedValue(true),
  avancarProxima: jest.fn().mockResolvedValue(undefined),
};

const rota: RouteData = {
  id: 'route-1',
  unidade_id: 'unit-1',
  status: 'pendente',
  unidade_nome: 'Unidade A',
};

const paradas: ParadaData[] = [
  {
    id: 'p1',
    endereco: 'Rua A, 123',
    ordem: 1,
    status: 'em_andamento',
    tipo: 'entrega',
    latitude: -23.55,
    longitude: -46.63,
  },
];

const loadActiveRoute = jest.fn().mockResolvedValue(undefined);

interface Props {
  route: RouteData | null;
  userData: { id: string; nome?: string } | null;
}

function montar(inicial: Props) {
  return renderHook(
    ({ route, userData }: Props) =>
      useRouteActions({
        route,
        paradas,
        userData,
        loadActiveRoute,
        portaParadas: porta,
      }),
    { initialProps: inicial },
  );
}

describe('useRouteActions: identidade das ações', () => {
  it('mantém a identidade das ações quando re-renderiza com os mesmos dados', () => {
    const { result, rerender } = montar({
      route: rota,
      userData: { id: 'm1', nome: 'Ana' },
    });
    const antes = result.current;

    // userData é um objeto novo (o provider o recria a cada render)
    rerender({ route: rota, userData: { id: 'm1', nome: 'Ana' } });
    const depois = result.current;

    expect(depois.startRoute).toBe(antes.startRoute);
    expect(depois.completeStop).toBe(antes.completeStop);
    expect(depois.skipStop).toBe(antes.skipStop);
    expect(depois.completeRoute).toBe(antes.completeRoute);
  });

  it('depois de a rota passar a em_andamento, concluir usa o status novo', async () => {
    const { result, rerender } = montar({
      route: rota,
      userData: { id: 'm1', nome: 'Ana' },
    });

    rerender({
      route: { ...rota, status: 'em_andamento' },
      userData: { id: 'm1', nome: 'Ana' },
    });

    await expect(result.current.completeStop('p1')).resolves.toBeDefined();
  });

  it('troca a ação quando o motorista muda', () => {
    const { result, rerender } = montar({
      route: rota,
      userData: { id: 'm1', nome: 'Ana' },
    });
    const antes = result.current;

    rerender({ route: rota, userData: { id: 'm2', nome: 'Beto' } });

    expect(result.current.completeStop).not.toBe(antes.completeStop);
  });
});
