import { Dimensions } from 'react-native';
import {
  BREAKPOINTS,
  getCurrentBreakpoint,
  isBreakpoint,
  getResponsiveSpacing,
  getResponsiveFontSize,
  getGridColumns,
  getModalWidth,
  getContentDensity,
  mediaQuery,
} from '../responsive';

// Mock React Native Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(),
  },
}));

const mockDimensions = Dimensions.get as jest.Mock;

describe('Responsive Utilities', () => {
  describe('BREAKPOINTS', () => {
    it('deve ter breakpoints corretos definidos', () => {
      expect(BREAKPOINTS.mobile).toBe(0);
      expect(BREAKPOINTS.tablet).toBe(768);
      expect(BREAKPOINTS.desktop).toBe(1024);
      expect(BREAKPOINTS.largeDesktop).toBe(1440);
    });

    it('breakpoints devem estar em ordem crescente', () => {
      expect(BREAKPOINTS.mobile).toBeLessThan(BREAKPOINTS.tablet);
      expect(BREAKPOINTS.tablet).toBeLessThan(BREAKPOINTS.desktop);
      expect(BREAKPOINTS.desktop).toBeLessThan(BREAKPOINTS.largeDesktop);
    });
  });

  describe('getCurrentBreakpoint', () => {
    it('deve retornar mobile para largura < 768', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getCurrentBreakpoint()).toBe('mobile');

      mockDimensions.mockReturnValue({ width: 767, height: 1024 });
      expect(getCurrentBreakpoint()).toBe('mobile');
    });

    it('deve retornar tablet para largura >= 768 e < 1024', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getCurrentBreakpoint()).toBe('tablet');

      mockDimensions.mockReturnValue({ width: 900, height: 1200 });
      expect(getCurrentBreakpoint()).toBe('tablet');

      mockDimensions.mockReturnValue({ width: 1023, height: 1366 });
      expect(getCurrentBreakpoint()).toBe('tablet');
    });

    it('deve retornar desktop para largura >= 1024 e < 1440', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getCurrentBreakpoint()).toBe('desktop');

      mockDimensions.mockReturnValue({ width: 1280, height: 720 });
      expect(getCurrentBreakpoint()).toBe('desktop');

      mockDimensions.mockReturnValue({ width: 1439, height: 900 });
      expect(getCurrentBreakpoint()).toBe('desktop');
    });

    it('deve retornar largeDesktop para largura >= 1440', () => {
      mockDimensions.mockReturnValue({ width: 1440, height: 900 });
      expect(getCurrentBreakpoint()).toBe('largeDesktop');

      mockDimensions.mockReturnValue({ width: 1920, height: 1080 });
      expect(getCurrentBreakpoint()).toBe('largeDesktop');

      mockDimensions.mockReturnValue({ width: 2560, height: 1440 });
      expect(getCurrentBreakpoint()).toBe('largeDesktop');
    });
  });

  describe('isBreakpoint', () => {
    it('deve retornar true quando largura >= breakpoint', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });

      expect(isBreakpoint('mobile')).toBe(true);
      expect(isBreakpoint('tablet')).toBe(true);
      expect(isBreakpoint('desktop')).toBe(true);
      expect(isBreakpoint('largeDesktop')).toBe(false);
    });

    it('deve retornar false quando largura < breakpoint', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });

      expect(isBreakpoint('mobile')).toBe(true);
      expect(isBreakpoint('tablet')).toBe(false);
      expect(isBreakpoint('desktop')).toBe(false);
      expect(isBreakpoint('largeDesktop')).toBe(false);
    });

    it('deve funcionar corretamente no limite do breakpoint', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(isBreakpoint('tablet')).toBe(true);

      mockDimensions.mockReturnValue({ width: 767, height: 1024 });
      expect(isBreakpoint('tablet')).toBe(false);
    });
  });

  describe('getResponsiveSpacing', () => {
    it('deve retornar base em mobile', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getResponsiveSpacing(16)).toBe(16);
      expect(getResponsiveSpacing(8)).toBe(8);
    });

    it('deve retornar base * 1.5 em tablet', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getResponsiveSpacing(16)).toBe(24);
      expect(getResponsiveSpacing(8)).toBe(12);
    });

    it('deve retornar base * 2 em desktop', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getResponsiveSpacing(16)).toBe(32);
      expect(getResponsiveSpacing(8)).toBe(16);
    });

    it('deve retornar base * 2.5 em largeDesktop', () => {
      mockDimensions.mockReturnValue({ width: 1920, height: 1080 });
      expect(getResponsiveSpacing(16)).toBe(40);
      expect(getResponsiveSpacing(8)).toBe(20);
    });
  });

  describe('getResponsiveFontSize', () => {
    it('deve retornar base em mobile', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getResponsiveFontSize(16)).toBe(16);
      expect(getResponsiveFontSize(14)).toBe(14);
    });

    it('deve retornar base * 1.0625 em tablet', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getResponsiveFontSize(16)).toBe(17);
      expect(getResponsiveFontSize(14)).toBeCloseTo(14.875, 2);
    });

    it('deve retornar base * 1.125 em desktop', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getResponsiveFontSize(16)).toBe(18);
      expect(getResponsiveFontSize(14)).toBeCloseTo(15.75, 2);
    });

    it('deve retornar base * 1.25 em largeDesktop', () => {
      mockDimensions.mockReturnValue({ width: 1920, height: 1080 });
      expect(getResponsiveFontSize(16)).toBe(20);
      expect(getResponsiveFontSize(14)).toBeCloseTo(17.5, 2);
    });
  });

  describe('getGridColumns', () => {
    it('deve retornar 1 coluna para larguras pequenas', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getGridColumns(300)).toBe(1);
    });

    it('deve retornar 2 colunas para tablet', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getGridColumns(300)).toBe(2);
    });

    it('deve retornar 3 colunas para desktop', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getGridColumns(300)).toBe(3);
    });

    it('deve respeitar máximo de 4 colunas', () => {
      mockDimensions.mockReturnValue({ width: 2560, height: 1440 });
      expect(getGridColumns(300)).toBe(4);
      expect(getGridColumns(100)).toBe(4);
    });

    it('deve respeitar mínimo de 1 coluna', () => {
      mockDimensions.mockReturnValue({ width: 200, height: 400 });
      expect(getGridColumns(300)).toBe(1);
    });

    it('deve aceitar minColumnWidth customizado', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getGridColumns(500)).toBe(2);
      expect(getGridColumns(200)).toBe(4);
    });
  });

  describe('getModalWidth', () => {
    it('deve retornar 90% da largura em mobile', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getModalWidth()).toBe(375 * 0.9);

      mockDimensions.mockReturnValue({ width: 414, height: 896 });
      expect(getModalWidth()).toBeCloseTo(372.6, 1);
    });

    it('deve retornar 500 em tablet', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getModalWidth()).toBe(500);
    });

    it('deve retornar 600 em desktop', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getModalWidth()).toBe(600);
    });

    it('deve retornar 800 em largeDesktop', () => {
      mockDimensions.mockReturnValue({ width: 1920, height: 1080 });
      expect(getModalWidth()).toBe(800);
    });
  });

  describe('getContentDensity', () => {
    it('deve retornar comfortable em mobile e tablet', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      expect(getContentDensity()).toBe('comfortable');

      mockDimensions.mockReturnValue({ width: 768, height: 1024 });
      expect(getContentDensity()).toBe('comfortable');
    });

    it('deve retornar normal em desktop', () => {
      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      expect(getContentDensity()).toBe('normal');

      mockDimensions.mockReturnValue({ width: 1280, height: 720 });
      expect(getContentDensity()).toBe('normal');
    });

    it('deve retornar compact em largeDesktop', () => {
      mockDimensions.mockReturnValue({ width: 1920, height: 1080 });
      expect(getContentDensity()).toBe('compact');

      mockDimensions.mockReturnValue({ width: 2560, height: 1440 });
      expect(getContentDensity()).toBe('compact');
    });
  });

  describe('mediaQuery', () => {
    it('deve ter media query para tablet', () => {
      expect(mediaQuery.tablet).toBe('@media (min-width: 768px)');
    });

    it('deve ter media query para desktop', () => {
      expect(mediaQuery.desktop).toBe('@media (min-width: 1024px)');
    });

    it('deve ter media query para largeDesktop', () => {
      expect(mediaQuery.largeDesktop).toBe('@media (min-width: 1440px)');
    });

    it('deve ter media query para hover', () => {
      expect(mediaQuery.hover).toBe('@media (hover: hover)');
    });
  });

  describe('Casos de uso reais', () => {
    it('iPhone SE (375x667) deve ser mobile', () => {
      mockDimensions.mockReturnValue({ width: 375, height: 667 });

      expect(getCurrentBreakpoint()).toBe('mobile');
      expect(getResponsiveSpacing(16)).toBe(16);
      expect(getResponsiveFontSize(16)).toBe(16);
      expect(getGridColumns()).toBe(1);
      expect(getContentDensity()).toBe('comfortable');
    });

    it('iPad (768x1024) deve ser tablet', () => {
      mockDimensions.mockReturnValue({ width: 768, height: 1024 });

      expect(getCurrentBreakpoint()).toBe('tablet');
      expect(getResponsiveSpacing(16)).toBe(24);
      expect(getResponsiveFontSize(16)).toBe(17);
      expect(getGridColumns()).toBe(2);
      expect(getContentDensity()).toBe('comfortable');
    });

    it('MacBook (1440x900) deve ser largeDesktop', () => {
      mockDimensions.mockReturnValue({ width: 1440, height: 900 });

      expect(getCurrentBreakpoint()).toBe('largeDesktop');
      expect(getResponsiveSpacing(16)).toBe(40);
      expect(getResponsiveFontSize(16)).toBe(20);
      expect(getGridColumns()).toBe(4);
      expect(getContentDensity()).toBe('compact');
    });

    it('deve calcular spacing consistente para design system', () => {
      const baseSpacing = 16;

      mockDimensions.mockReturnValue({ width: 375, height: 667 });
      const mobileSpacing = getResponsiveSpacing(baseSpacing);

      mockDimensions.mockReturnValue({ width: 1024, height: 768 });
      const desktopSpacing = getResponsiveSpacing(baseSpacing);

      expect(desktopSpacing).toBeGreaterThan(mobileSpacing);
      expect(desktopSpacing / mobileSpacing).toBe(2); // Relação 2x
    });
  });
});
