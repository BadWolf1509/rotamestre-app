import { renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { useBreakpoint, useResponsiveValue } from '../useBreakpoint';

// Mock dos módulos do react-native
jest.mock('react-native', () => ({
    Dimensions: {
        get: jest.fn(() => ({ width: 1024, height: 768 })),
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
    Platform: {
        OS: 'web',
    },
    StyleSheet: {
        create: (styles: any) => styles,
    },
    View: 'View',
    Text: 'Text',
}));

describe('useBreakpoint', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    });

    describe('Initial state', () => {
        it('deve retornar dimensões corretas', () => {
            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.width).toBe(1024);
            expect(result.current.height).toBe(768);
        });

        it('deve retornar breakpoint desktop para largura 1024', () => {
            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isDesktop).toBe(true);
            expect(result.current.breakpoint).toBe('desktop');
        });

        it('deve retornar isWeb correto', () => {
            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isWeb).toBe(true);
        });
    });

    describe('Breakpoint detection', () => {
        it('deve detectar mobile (< 768)', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 375, height: 667 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isMobile).toBe(true);
            expect(result.current.isTablet).toBe(false);
            expect(result.current.isDesktop).toBe(false);
            expect(result.current.isLargeDesktop).toBe(false);
            expect(result.current.breakpoint).toBe('mobile');
        });

        it('deve detectar tablet (768-1023)', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 800, height: 600 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isMobile).toBe(false);
            expect(result.current.isTablet).toBe(true);
            expect(result.current.breakpoint).toBe('tablet');
        });

        it('deve detectar desktop (1024-1439)', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 1200, height: 800 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isDesktop).toBe(true);
            expect(result.current.breakpoint).toBe('desktop');
        });

        it('deve detectar largeDesktop (>= 1440)', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isLargeDesktop).toBe(true);
            expect(result.current.breakpoint).toBe('largeDesktop');
        });
    });

    describe('Boundary cases', () => {
        it('deve ser tablet exatamente em 768px', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 768, height: 600 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isTablet).toBe(true);
            expect(result.current.breakpoint).toBe('tablet');
        });

        it('deve ser desktop exatamente em 1024px', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 1024, height: 768 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isDesktop).toBe(true);
            expect(result.current.breakpoint).toBe('desktop');
        });

        it('deve ser largeDesktop exatamente em 1440px', () => {
            (Dimensions.get as jest.Mock).mockReturnValue({ width: 1440, height: 900 });

            const { result } = renderHook(() => useBreakpoint());

            expect(result.current.isLargeDesktop).toBe(true);
            expect(result.current.breakpoint).toBe('largeDesktop');
        });
    });

    describe('Dimension listener', () => {
        it('deve adicionar listener de dimensões', () => {
            renderHook(() => useBreakpoint());

            expect(Dimensions.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        });
    });
});

describe('useResponsiveValue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('deve retornar valor mobile por padrão', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 375, height: 667 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
                tablet: 24,
                desktop: 32,
            })
        );

        expect(result.current).toBe(16);
    });

    it('deve retornar valor tablet quando aplicável', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 800, height: 600 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
                tablet: 24,
                desktop: 32,
            })
        );

        expect(result.current).toBe(24);
    });

    it('deve retornar valor desktop quando aplicável', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 1200, height: 800 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
                tablet: 24,
                desktop: 32,
            })
        );

        expect(result.current).toBe(32);
    });

    it('deve retornar valor largeDesktop quando aplicável', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
                tablet: 24,
                desktop: 32,
                largeDesktop: 48,
            })
        );

        expect(result.current).toBe(48);
    });

    it('deve fazer fallback para mobile quando valor não definido', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 800, height: 600 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
            })
        );

        expect(result.current).toBe(16);
    });

    it('deve fazer fallback para desktop quando largeDesktop não definido', () => {
        (Dimensions.get as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });

        const { result } = renderHook(() =>
            useResponsiveValue({
                mobile: 16,
                desktop: 32,
            })
        );

        expect(result.current).toBe(16);
    });
});
