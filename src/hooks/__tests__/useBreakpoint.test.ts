import { renderHook, act } from '@testing-library/react-hooks';
import { Dimensions, Platform } from 'react-native';
import { useBreakpoint, useResponsiveValue } from '../useBreakpoint';

// Mock Dimensions
const mockDimensions = {
  get: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

jest.mock('react-native/Libraries/Utilities/Dimensions', () => mockDimensions);

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  };
  return platform;
});

describe('useBreakpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default dimensions
    mockDimensions.get.mockReturnValue({ width: 375, height: 812 });
    mockDimensions.addEventListener.mockReturnValue({ remove: jest.fn() });
  });

  it('deve detectar mobile corretamente (< 768px)', () => {
    mockDimensions.get.mockReturnValue({ width: 375, height: 812 });
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.breakpoint).toBe('mobile');
  });

  it('deve detectar tablet corretamente (768px - 1023px)', () => {
    mockDimensions.get.mockReturnValue({ width: 800, height: 1024 });
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.breakpoint).toBe('tablet');
  });

  it('deve detectar desktop corretamente (1024px - 1439px)', () => {
    mockDimensions.get.mockReturnValue({ width: 1280, height: 800 });
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isLargeDesktop).toBe(false);
    expect(result.current.breakpoint).toBe('desktop');
  });

  it('deve detectar largeDesktop corretamente (>= 1440px)', () => {
    mockDimensions.get.mockReturnValue({ width: 1920, height: 1080 });
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isLargeDesktop).toBe(true);
    expect(result.current.breakpoint).toBe('largeDesktop');
  });

  it('deve atualizar quando dimensões mudam', () => {
    let changeCallback: any;
    mockDimensions.addEventListener.mockImplementation((event, callback) => {
      changeCallback = callback;
      return { remove: jest.fn() };
    });

    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isMobile).toBe(true);

    // Simular mudança de dimensão
    act(() => {
      if (changeCallback) {
        changeCallback({ window: { width: 1024, height: 768 } });
      }
    });

    expect(result.current.isDesktop).toBe(true);
  });
});

describe('useResponsiveValue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDimensions.get.mockReturnValue({ width: 375, height: 812 });
    mockDimensions.addEventListener.mockReturnValue({ remove: jest.fn() });
  });

  it('deve retornar valor mobile por padrão', () => {
    mockDimensions.get.mockReturnValue({ width: 375, height: 812 });
    const { result } = renderHook(() => useResponsiveValue({ mobile: 10, tablet: 20, desktop: 30 }));
    expect(result.current).toBe(10);
  });

  it('deve retornar valor tablet', () => {
    mockDimensions.get.mockReturnValue({ width: 800, height: 1024 });
    const { result } = renderHook(() => useResponsiveValue({ mobile: 10, tablet: 20, desktop: 30 }));
    expect(result.current).toBe(20);
  });

  it('deve retornar valor desktop', () => {
    mockDimensions.get.mockReturnValue({ width: 1280, height: 800 });
    const { result } = renderHook(() => useResponsiveValue({ mobile: 10, tablet: 20, desktop: 30 }));
    expect(result.current).toBe(30);
  });

  it('deve fazer fallback para valor menor se não definido', () => {
    mockDimensions.get.mockReturnValue({ width: 1280, height: 800 }); // Desktop
    // Desktop não definido, deve pegar tablet ou mobile
    const { result } = renderHook(() => useResponsiveValue({ mobile: 10 }));
    expect(result.current).toBe(10);
  });
});
