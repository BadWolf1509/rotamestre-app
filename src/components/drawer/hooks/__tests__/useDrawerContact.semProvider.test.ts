/**
 * O menu lateral também monta no layout do gestor, que não tem
 * RouteStatusProvider: o hook não pode exigir o provider.
 * Aqui o `@/context/RouteStatusContext` NÃO é mockado, de propósito.
 */

import { renderHook } from '@testing-library/react-native';

jest.mock('@/hooks/useUser', () => ({
  useUser: jest.fn(() => ({
    userData: { nome: 'João Gestor' },
  })),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(() => ({
      maybeSingle: jest.fn(),
      single: jest.fn(),
    })),
  },
}));

import { useDrawerContact } from '../useDrawerContact';

describe('useDrawerContact sem RouteStatusProvider', () => {
  it('monta fora do RouteStatusProvider, como no layout do gestor', () => {
    expect(() =>
      renderHook(() => useDrawerContact({ onClose: jest.fn() })),
    ).not.toThrow();
  });
});
