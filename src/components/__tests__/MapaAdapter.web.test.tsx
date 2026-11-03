import { render } from '@testing-library/react-native';
import React from 'react';

import type { MapaAdapterProps } from '@/types/parada-map';

import { MapaAdapter } from '../MapaAdapter.web';

jest.mock('../MapaWebMapLibre', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockMapaWeb = require('../MapaWebMapLibre').default;

describe('MapaAdapter (Web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('repassa todas as props da interface ao MapaWebMapLibre', () => {
    // O Required<…> só documenta: os testes ficam fora do tsc. Quem garante que prop
    // nova chega ao mapa é o spread do adapter, vigiado pela guarda interfaceUnica.
    const props: Required<MapaAdapterProps> = {
      paradas: [
        {
          id: '1',
          ordem: 1,
          endereco: 'Rua Teste, 123',
          latitude: -23.5505,
          longitude: -46.6333,
          status: 'pendente',
        },
      ],
      selectedParadaId: '1',
      onMarkerPress: jest.fn(),
      onSelectedMarkerPress: jest.fn(),
      onMapPress: jest.fn(),
      statusFilter: 'pendente',
      rotaId: 'rota-123',
      motoristaNome: 'João',
      showMotorista: true,
      unidadeNome: 'Unidade Centro',
      polyline: 'encoded-road-geometry',
      storedRouteInfo: { distanceMeters: 9300, durationSeconds: 660 },
    };

    render(<MapaAdapter {...props} />);

    expect(mockMapaWeb.mock.calls[0][0]).toEqual(props);
  });
});
