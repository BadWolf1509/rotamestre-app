/**
 * O estado inicial das preferências vem da tabela única de padrões, não de uma
 * cópia local do hook.
 */

import { renderHook } from '@testing-library/react-native';

import { useNavigationModeLogic } from '../useNavigationModeLogic';

// Padrões ALTERADOS: só a leitura da tabela única pode fazer o teste passar.
jest.mock('@/lib/motorista/preferenciasNavegacaoPadrao', () => {
  const real = jest.requireActual(
    '@/lib/motorista/preferenciasNavegacaoPadrao',
  );
  return {
    ...real,
    PREFERENCIAS_PADRAO: {
      ...real.PREFERENCIAS_PADRAO,
      navegarCom: 'externo',
      proximityRadius: 80,
      soundAlerts: false,
    },
  };
});

jest.mock('@/lib/osrm', () => ({
  calculateHaversineDistance: jest.fn().mockReturnValue(500),
  getRoute: jest.fn().mockResolvedValue({ polyline: 'mock_polyline' }),
  decodePolyline: jest.fn().mockReturnValue([]),
}));

jest.mock('@/services/locationTracking', () => ({
  __esModule: true,
  default: {
    startTracking: jest.fn().mockResolvedValue(true),
    stopTracking: jest.fn().mockResolvedValue(undefined),
    // Carga que nunca termina: o que se lê é o estado inicial.
    getNavigationPreferences: jest.fn(() => new Promise(() => {})),
  },
}));

jest.mock('@/utils/styles', () => ({
  useUnistyles: jest.fn().mockReturnValue({
    theme: {
      colors: { success: '#00FF00', warning: '#FFFF00', error: '#FF0000' },
    },
  }),
}));

const parada = {
  id: 'parada-1',
  ordem: 1,
  tipo: 'entrega' as const,
  status: 'pendente' as const,
  endereco: 'Rua Teste, 123',
  latitude: -23.55,
  longitude: -46.63,
  destinatario: 'Cliente Teste',
  telefone: '11999999999',
};

describe('useNavigationModeLogic: padrões', () => {
  it('antes de carregar, usa a tabela única de padrões', () => {
    const { result } = renderHook(() =>
      useNavigationModeLogic({
        currentStop: parada,
        nextStop: null,
        paradas: [parada],
        rotaId: 'rota-123',
      }),
    );

    expect(result.current.preferences).toEqual(
      require('@/lib/motorista/preferenciasNavegacaoPadrao')
        .PREFERENCIAS_PADRAO,
    );
  });
});
