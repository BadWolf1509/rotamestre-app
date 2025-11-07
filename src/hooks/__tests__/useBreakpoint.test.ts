import { renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { useBreakpoint } from '../useBreakpoint';

// Mock do Dimensions.get
jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

describe('useBreakpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Detecção de Breakpoints', () => {
    it('deve detectar mobile (< 768px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isLargeDesktop).toBe(false);
      expect(result.current.breakpoint).toBe('mobile');
    });

    it('deve detectar mobile no limite superior (767px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 767, height: 1024, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
    });

    it('deve detectar tablet (768px - 1023px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 768, height: 1024, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isLargeDesktop).toBe(false);
      expect(result.current.breakpoint).toBe('tablet');
    });

    it('deve detectar tablet no limite superior (1023px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1023, height: 768, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
    });

    it('deve detectar desktop (1024px - 1439px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1024, height: 768, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isLargeDesktop).toBe(false);
      expect(result.current.breakpoint).toBe('desktop');
    });

    it('deve detectar desktop no limite superior (1439px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1439, height: 900, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isDesktop).toBe(true);
      expect(result.current.isLargeDesktop).toBe(false);
    });

    it('deve detectar large desktop (>= 1440px)', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1920, height: 1080, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.isLargeDesktop).toBe(true);
      expect(result.current.breakpoint).toBe('largeDesktop');
    });
  });

  describe('Propriedades Retornadas', () => {
    it('deve retornar width e height corretos', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(result.current.width).toBe(375);
      expect(result.current.height).toBe(667);
    });

    it('deve retornar informação de plataforma', () => {
      jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });

      const { result } = renderHook(() => useBreakpoint());

      expect(typeof result.current.isWeb).toBe('boolean');
    });
  });
});
