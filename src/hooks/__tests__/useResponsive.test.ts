/**
 * BLOQUEIO CONHECIDO (2025-11-20):
 * 
 * Este teste suite está bloqueado devido a erro de TurboModuleRegistry ao tentar
 * mockar react-native em ambiente Jest:
 * 
 * "TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be found"
 * 
 * Tentativas realizadas:
 * 1. Remoção de mock global de jest.setup.js ❌
 * 2. Simplificação de mocks (apenas useWindowDimensions) ❌
 * 3. Uso de jest.requireActual para evitar conflitos ❌
 * 
 * O erro persiste ao tentar mockar react-native, independente da abordagem.
 * 
 * Solução Recomendada:
 * - Testar apenas createResponsiveStyles (função pura, não depende de RN)
 * - Considerar testes E2E para o hook useResponsive
 * - OU refatorar ambiente Jest para lidar melhor com TurboModules
 * 
 * Status: BLOQUEADO - Requer investigação dedicada ou mudança de estratégia
 */

import { renderHook } from '@testing-library/react-native';
import { useResponsive, createResponsiveStyles } from '../useResponsive';

// Mock apenas useWindowDimensions
const mockUseWindowDimensions = jest.fn();

jest.mock('react-native', () => {
  const actualRN = jest.requireActual('react-native');
  return {
    ...actualRN,
    useWindowDimensions: mockUseWindowDimensions,
  };
});

describe('useResponsive', () => {
  const mockDimensions = (width: number, height: number = 800) => {
    mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDimensions(375); // Default mobile
  });

  it('deve detectar mobile', () => {
    mockDimensions(375);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('deve detectar tablet', () => {
    mockDimensions(800);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isTablet).toBe(true);
    expect(result.current.breakpoint).toBe('tablet');
  });

  it('deve detectar desktop', () => {
    mockDimensions(1200);
    const { result } = renderHook(() => useResponsive());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.breakpoint).toBe('desktop');
  });

  it('deve detectar orientação portrait', () => {
    mockDimensions(400, 800);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.orientation).toBe('portrait');
  });

  it('deve detectar orientação landscape', () => {
    mockDimensions(800, 400);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.orientation).toBe('landscape');
  });
});

describe('createResponsiveStyles', () => {
  it('deve criar estilos para mobile', () => {
    const styles = createResponsiveStyles(375);
    expect(styles.isMobile).toBe(true);
    expect(styles.gridColumns).toBe(1);
    expect(styles.containerMaxWidth).toBe('100%');
  });

  it('deve criar estilos para desktop', () => {
    const styles = createResponsiveStyles(1200);
    expect(styles.isDesktop).toBe(true);
    expect(styles.gridColumns).toBe(4);
    expect(styles.containerMaxWidth).toBe(1280);
  });
});
