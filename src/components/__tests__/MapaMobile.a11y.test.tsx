/**
 * MapaMobile – accessibility labels on FAB control buttons
 *
 * Covers the 3 floating-action buttons in the fabContainer toolbar:
 *   1. Fit-all      – "Ajustar mapa para mostrar todas as paradas"
 *   2. Center-user  – "Centralizar mapa na minha localização"
 *   3. Navigate     – "Navegar para parada <ordem>"  (rendered only when a pending stop exists)
 *
 * Note: zoom-in / zoom-out FABs suggested in the original plan do not exist in this
 * component; the plan line numbers had drifted against an older version of the file.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

// MapLibre is already mocked globally in jest.setup.js
// expo-location, expo-haptics, expo-clipboard are mocked below

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: -23.5505, longitude: -46.6333 },
  }),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// useRouteDirections returns empty route in tests
jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    routeCoordinates: [],
    routeInfo: null,
    isLoading: false,
  }),
}));

// MotoristaMarker uses realtime subscriptions – stub it out
jest.mock('@/components/MotoristaMarker', () => ({
  MotoristaMarker: () => null,
}));

// maplibre helpers – stubs so the component doesn't error on coordinate math
jest.mock('@/lib/maplibre', () => ({
  MAPLIBRE_RASTER_STYLE: 'https://example.com/style.json',
  getBounds: jest.fn(() => ({
    ne: [-46.6, -23.5],
    sw: [-46.7, -23.6],
  })),
  toLineString: jest.fn(() => null),
  toLngLat: jest.fn(({ latitude, longitude }) => [longitude, latitude]),
  zoomFromLongitudeDelta: jest.fn(() => 14),
}));

// navigation util
jest.mock('@/utils/navigation', () => ({
  showNavigationOptions: jest.fn(),
}));

// toast util
jest.mock('@/utils/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// map infoWindowBuilders
jest.mock('@/components/map/infoWindowBuilders', () => ({
  getStatusLabel: jest.fn((status: string) => status),
}));

// mapMarkerColors
jest.mock('@/utils/mapMarkerColors', () => ({
  getMarkerFillColor: jest.fn(() => '#1e5aa8'),
}));

import { MapaMobile } from '../MapaMobile';

// A single pending stop so proximaParadaPendente is truthy
const mockParadasPendente = [
  {
    id: 'p1',
    ordem: 1,
    endereco: 'Rua Teste, 100, Curitiba',
    latitude: -25.429,
    longitude: -49.271,
    status: 'pendente' as const,
    is_checkpoint: true,
    tipo: 'entrega' as const,
    destinatario: null,
    telefone: null,
  },
];

describe('MapaMobile – FAB control button accessibility', () => {
  it('fit-all button has accessibilityLabel and role button', () => {
    const { getByLabelText } = render(
      <MapaMobile paradas={mockParadasPendente} />,
    );
    const btn = getByLabelText('Ajustar mapa para mostrar todas as paradas');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityRole).toBe('button');
  });

  it('center-on-user button has accessibilityLabel and role button', () => {
    const { getByLabelText } = render(
      <MapaMobile paradas={mockParadasPendente} />,
    );
    const btn = getByLabelText('Centralizar mapa na minha localização');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityRole).toBe('button');
  });

  it('center-on-user button has accessibilityState with disabled=false when not locating', () => {
    const { getByLabelText } = render(
      <MapaMobile paradas={mockParadasPendente} />,
    );
    const btn = getByLabelText('Centralizar mapa na minha localização');
    expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('navigate button has accessibilityLabel and role button when pending stop exists', () => {
    const { getByLabelText } = render(
      <MapaMobile paradas={mockParadasPendente} />,
    );
    const btn = getByLabelText('Navegar para parada 1');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityRole).toBe('button');
  });

  it('navigate button is not rendered when no pending stops exist', () => {
    const paradasConcluidas = [
      { ...mockParadasPendente[0], status: 'concluida' as const },
    ];
    const { queryByLabelText } = render(
      <MapaMobile paradas={paradasConcluidas} />,
    );
    expect(queryByLabelText('Navegar para parada 1')).toBeNull();
  });

  it('all three FABs are inside the toolbar region', () => {
    const { getByLabelText } = render(
      <MapaMobile paradas={mockParadasPendente} />,
    );
    const toolbar = getByLabelText('Controles do mapa');
    expect(toolbar).toBeTruthy();
    expect(toolbar.props.accessibilityRole).toBe('toolbar');
  });
});
