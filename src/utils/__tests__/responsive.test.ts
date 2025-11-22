import { Dimensions } from 'react-native';

import {
  getCurrentBreakpoint,
  isBreakpoint,
  getResponsiveSpacing,
  getResponsiveFontSize,
  getGridColumns,
  getModalWidth,
  getContentDensity,
} from '../responsive';

// Mock react-native Dimensions
jest.mock('react-native', () => ({
  Dimensions: {
    get: jest.fn(),
  },
}));

describe('responsive utils', () => {
  const mockWidth = (width: number) => {
    (Dimensions.get as jest.Mock).mockReturnValue({ width, height: 800 });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentBreakpoint', () => {
    it('deve detectar mobile (< 768)', () => {
      mockWidth(375);
      expect(getCurrentBreakpoint()).toBe('mobile');
    });

    it('deve detectar tablet (>= 768)', () => {
      mockWidth(768);
      expect(getCurrentBreakpoint()).toBe('tablet');
    });

    it('deve detectar desktop (>= 1024)', () => {
      mockWidth(1024);
      expect(getCurrentBreakpoint()).toBe('desktop');
    });

    it('deve detectar largeDesktop (>= 1440)', () => {
      mockWidth(1440);
      expect(getCurrentBreakpoint()).toBe('largeDesktop');
    });
  });

  describe('isBreakpoint', () => {
    it('deve retornar true se largura >= breakpoint', () => {
      mockWidth(800);
      expect(isBreakpoint('tablet')).toBe(true); // 800 >= 768
      expect(isBreakpoint('mobile')).toBe(true); // 800 >= 0
      expect(isBreakpoint('desktop')).toBe(false); // 800 < 1024
    });
  });

  describe('getResponsiveSpacing', () => {
    it('deve escalar espaçamento base', () => {
      const base = 16;

      mockWidth(375); // Mobile
      expect(getResponsiveSpacing(base)).toBe(16);

      mockWidth(800); // Tablet
      expect(getResponsiveSpacing(base)).toBe(24); // 1.5x

      mockWidth(1200); // Desktop
      expect(getResponsiveSpacing(base)).toBe(32); // 2x

      mockWidth(1600); // Large Desktop
      expect(getResponsiveSpacing(base)).toBe(40); // 2.5x
    });
  });

  describe('getResponsiveFontSize', () => {
    it('deve escalar fonte base', () => {
      const base = 16;

      mockWidth(375);
      expect(getResponsiveFontSize(base)).toBe(16);

      mockWidth(800);
      expect(getResponsiveFontSize(base)).toBe(17); // 1.0625x

      mockWidth(1200);
      expect(getResponsiveFontSize(base)).toBe(18); // 1.125x

      mockWidth(1600);
      expect(getResponsiveFontSize(base)).toBe(20); // 1.25x
    });
  });

  describe('getGridColumns', () => {
    it('deve calcular colunas baseado na largura mínima', () => {
      mockWidth(1200);
      // 1200 / 300 = 4
      expect(getGridColumns(300)).toBe(4);

      mockWidth(500);
      // 500 / 300 = 1.66 -> 1
      expect(getGridColumns(300)).toBe(1);
    });

    it('deve respeitar limites min/max', () => {
      mockWidth(2000);
      // 2000 / 300 = 6.66 -> max 4
      expect(getGridColumns(300)).toBe(4);
    });
  });

  describe('getModalWidth', () => {
    it('deve retornar largura fixa para telas grandes', () => {
      mockWidth(1600);
      expect(getModalWidth()).toBe(800);

      mockWidth(1200);
      expect(getModalWidth()).toBe(600);

      mockWidth(800);
      expect(getModalWidth()).toBe(500);
    });

    it('deve retornar porcentagem para mobile', () => {
      mockWidth(400);
      expect(getModalWidth()).toBe(360); // 90% de 400
    });
  });

  describe('getContentDensity', () => {
    it('deve retornar densidade correta', () => {
      mockWidth(1600);
      expect(getContentDensity()).toBe('compact');

      mockWidth(1200);
      expect(getContentDensity()).toBe('normal');

      mockWidth(800);
      expect(getContentDensity()).toBe('comfortable');
    });
  });
});
