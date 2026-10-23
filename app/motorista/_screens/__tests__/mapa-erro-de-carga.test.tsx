/**
 * Aba Mapa: falha na carga inicial não é "Nenhuma rota para visualizar".
 *
 * POR QUE EXISTE. Sem rota e com erro (sem sinal ao abrir o app), a aba dizia
 * que não havia rota — o motorista no meio da rota acreditava nisso. Agora
 * mostra "Sem conexão" com "Tentar novamente".
 */
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import MapaMotorista from '../mapa';

const mockRefreshRoute = jest.fn(() => Promise.resolve());
const mockCtx: { error: Error | null; atualizadoEm: number | null } = {
  error: null,
  atualizadoEm: null,
};

jest.mock('@/context/RouteStatusContext', () => ({
  useRouteStatus: () => ({
    route: null,
    paradas: [],
    loading: false,
    error: mockCtx.error,
    atualizadoEm: mockCtx.atualizadoEm,
    routeStatus: 'no-route',
    refreshRoute: mockRefreshRoute,
    completeStop: jest.fn(),
  }),
}));

jest.mock('@/components/MapaAdapter', () => ({ MapaAdapter: () => null }));
jest.mock('@/hooks/useDriverLocationBroadcast', () => ({
  useDriverLocationBroadcast: jest.fn(),
}));

describe('aba Mapa — erro na carga', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx.error = null;
    mockCtx.atualizadoEm = null;
  });

  it('erro sem nunca ter carregado: "Sem conexão" com tentar de novo', () => {
    mockCtx.error = new Error('Network request failed');
    const { getByText, queryByText } = render(<MapaMotorista />);

    expect(getByText('Sem conexão')).toBeTruthy();
    expect(queryByText('Nenhuma rota para visualizar')).toBeNull();

    fireEvent.press(getByText('Tentar novamente'));
    expect(mockRefreshRoute).toHaveBeenCalledTimes(1);
  });

  it('sem erro: o vazio de sempre', () => {
    const { getByText } = render(<MapaMotorista />);
    expect(getByText('Nenhuma rota para visualizar')).toBeTruthy();
  });
});
