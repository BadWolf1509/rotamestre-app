import { renderHook } from '@testing-library/react-native';
import { useResponsive } from '../useResponsive';

// Mock básico para useWindowDimensions retornar valores padrão
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => {
  return {
    default: jest.fn(() => ({ width: 375, height: 667 })),
  };
});

describe('useResponsive', () => {
  it('deve retornar propriedades básicas do hook', () => {
    const { result } = renderHook(() => useResponsive());

    // Verifica que o hook retorna as propriedades principais
    expect(result.current).toHaveProperty('width');
    expect(result.current).toHaveProperty('height');
    expect(result.current).toHaveProperty('isMobile');
    expect(result.current).toHaveProperty('isTablet');
    expect(result.current).toHaveProperty('isDesktop');
  });

  it('deve retornar valores booleanos para flags de breakpoint', () => {
    const { result } = renderHook(() => useResponsive());

    expect(typeof result.current.isMobile).toBe('boolean');
    expect(typeof result.current.isTablet).toBe('boolean');
    expect(typeof result.current.isDesktop).toBe('boolean');
  });

  it('deve retornar width e height como números', () => {
    const { result } = renderHook(() => useResponsive());

    expect(typeof result.current.width).toBe('number');
    expect(typeof result.current.height).toBe('number');
    expect(result.current.width).toBeGreaterThan(0);
    expect(result.current.height).toBeGreaterThan(0);
  });

  it('deve ter apenas um breakpoint ativo por vez', () => {
    const { result } = renderHook(() => useResponsive());

    const activeBreakpoints = [
      result.current.isMobile,
      result.current.isTablet,
      result.current.isDesktop,
    ].filter(Boolean);

    expect(activeBreakpoints.length).toBe(1);
  });

  it('deve retornar isMobile como true para width < 768', () => {
    const { result } = renderHook(() => useResponsive());

    // O mock retorna width: 375
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });
});
