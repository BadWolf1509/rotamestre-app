/**
 * MapaMobile – toque nos pinos (nativo).
 *
 * No Android, o maplibre-react-native reposiciona o filho do <Marker> por
 * view.x/view.y, fora do conhecimento do Fabric. O `measure()` do Pressable
 * devolve então a posição da árvore React, não a da tela: o primeiro
 * micro-movimento do dedo sai da "região" e o onPress nunca dispara (só a
 * animação de pressionar). Quem recebe o toque é o mapa nativo, que o
 * entrega ao `onPress` do próprio <Marker>. Por isso o toque é tratado ali.
 *
 * O evento do Marker sobe por bubbling até o `onPress` do <Map> (issue
 * maplibre-react-native#1618), que fecha o bottom sheet — daí o
 * stopPropagation.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@/hooks/useRouteDirections', () => ({
  useRouteDirections: () => ({
    routeCoordinates: [],
    routeInfo: null,
    isLoading: false,
  }),
}));

jest.mock('@/components/MotoristaMarker', () => ({
  MotoristaMarker: () => null,
}));

import { MapaMobile } from '../MapaMobile';

const partida = {
  id: 'cp0',
  ordem: 0,
  endereco: 'Base, 1',
  latitude: -25.42,
  longitude: -49.27,
  status: 'pendente' as const,
  is_checkpoint: false,
};

const parada = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua Teste, 100',
  latitude: -25.43,
  longitude: -49.28,
  status: 'pendente' as const,
  is_checkpoint: true,
  tipo: 'entrega' as const,
};

/** Toque como o mapa nativo o entrega: no <Marker>, com evento que propaga. */
function tocarMarcador(marcador: Parameters<typeof fireEvent>[0]) {
  const stopPropagation = jest.fn();
  fireEvent(marcador, 'press', { stopPropagation });
  return stopPropagation;
}

describe('MapaMobile – toque no pino', () => {
  it('toque no Marker da parada seleciona a parada sem chegar ao mapa', () => {
    const onMarkerPress = jest.fn();
    const onMapPress = jest.fn();
    const { getAllByTestId } = render(
      <MapaMobile
        paradas={[partida, parada]}
        onMarkerPress={onMarkerPress}
        onMapPress={onMapPress}
      />,
    );

    // checkpoints são renderizados antes das paradas
    const stopPropagation = tocarMarcador(getAllByTestId('marker')[1]);

    expect(onMarkerPress).toHaveBeenCalledWith('p1');
    expect(stopPropagation).toHaveBeenCalled();
    expect(onMapPress).not.toHaveBeenCalled();
  });

  it('toque no pino agrupado seleciona a parada principal do local', () => {
    const onMarkerPress = jest.fn();
    const concluida = {
      ...parada,
      id: 'p0',
      ordem: 1,
      status: 'concluida' as const,
    };
    const pendente = {
      ...parada,
      id: 'p2',
      ordem: 2,
      tipo: 'retirada' as const,
    };
    const { getAllByTestId } = render(
      <MapaMobile
        paradas={[partida, concluida, pendente]}
        onMarkerPress={onMarkerPress}
      />,
    );

    const marcadores = getAllByTestId('marker');
    expect(marcadores).toHaveLength(2); // partida + um pino para o local
    tocarMarcador(marcadores[1]);

    expect(onMarkerPress).toHaveBeenCalledWith('p2');
  });

  it('toque no Marker do checkpoint abre o balão dele', () => {
    const { getAllByTestId, queryByText } = render(
      <MapaMobile paradas={[partida, parada]} />,
    );
    expect(queryByText('Copiar endereço')).toBeNull();

    const stopPropagation = tocarMarcador(getAllByTestId('marker')[0]);

    expect(queryByText('Copiar endereço')).toBeTruthy();
    expect(stopPropagation).toHaveBeenCalled();
  });
});
