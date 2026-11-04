/**
 * Sem provider, o contexto da rota não pode devolver `{}` calado: quem lê
 * `route`/`currentStop` receberia undefined e esconderia a montagem errada.
 */

import { renderHook } from '@testing-library/react-native';

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({ userData: null, loading: false })),
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ session: null })),
}));

import { useRouteStatus, useRouteStatusSeHouver } from '../RouteStatusContext';

describe('RouteStatusContext fora do provider', () => {
  let erroSpy: jest.SpyInstance;

  beforeEach(() => {
    // O React loga o erro lançado no render; ele é esperado aqui.
    erroSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    erroSpy.mockRestore();
  });

  it('useRouteStatus fora do provider lança com mensagem clara', () => {
    expect(() => renderHook(() => useRouteStatus())).toThrow(
      'useRouteStatus must be used within RouteStatusProvider',
    );
  });

  it('useRouteStatusSeHouver fora do provider devolve null', () => {
    expect(
      renderHook(() => useRouteStatusSeHouver()).result.current,
    ).toBeNull();
  });
});
