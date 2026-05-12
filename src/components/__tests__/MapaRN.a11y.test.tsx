/**
 * MapaRN – accessibility label on the "Iniciar Navegação" button
 */

import { render } from '@testing-library/react-native';
import React from 'react';

// Global jest.setup.js already mocks @maplibre/maplibre-react-native

jest.mock('@/hooks/useAlert', () => ({
  useAlert: () => ({
    showError: jest.fn(),
    AlertDialog: null,
  }),
}));

jest.mock('@/components/map/hooks', () => ({
  useDirectionsMobile: () => ({
    directions: null,
  }),
}));

jest.mock('@/components/map/infoWindowBuilders', () => ({
  getStatusColor: jest.fn(() => '#1e5aa8'),
}));

jest.mock('@/lib/maplibre', () => ({
  MAPLIBRE_RASTER_STYLE: 'https://example.com/style.json',
  toLineString: jest.fn(() => null),
  toLngLat: jest.fn(
    ({ latitude, longitude }: { latitude: number; longitude: number }) => [
      longitude,
      latitude,
    ],
  ),
  zoomFromLongitudeDelta: jest.fn(() => 14),
}));

import { MapaRN } from '../MapaRN';

const mockParadas = [
  {
    id: 'p1',
    ordem: 1,
    endereco: 'Rua Teste, 100',
    latitude: -25.429,
    longitude: -49.271,
    status: 'pendente' as const,
    is_checkpoint: true,
    tipo: 'entrega' as const,
    destinatario: null,
    telefone: null,
  },
];

describe('MapaRN – navigation button accessibility', () => {
  it('Iniciar Navegação button has accessibilityLabel and role button', () => {
    const { getByLabelText } = render(
      <MapaRN paradas={mockParadas} rotaAtiva={true} />,
    );
    const btn = getByLabelText('Navegar para destino');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityRole).toBe('button');
  });
});
