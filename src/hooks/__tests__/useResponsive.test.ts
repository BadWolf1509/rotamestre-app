/**
 * Testes para useResponsive
 *
 * NOTA: O hook useResponsive depende de useWindowDimensions do React Native,
 * que causa problemas de TurboModuleRegistry quando mockado.
 *
 * Por isso, testamos apenas a função pura createResponsiveStyles.
 */

import { createResponsiveStyles } from '../useResponsive';

describe('createResponsiveStyles', () => {
  describe('detecção de breakpoints', () => {
    it('deve retornar isMobile=true para largura < 768', () => {
      const result = createResponsiveStyles(375);

      expect(result.isMobile).toBe(true);
      expect(result.isTablet).toBe(false);
      expect(result.isDesktop).toBe(false);
    });

    it('deve retornar isTablet=true para largura entre 768 e 1023', () => {
      const result = createResponsiveStyles(800);

      expect(result.isMobile).toBe(false);
      expect(result.isTablet).toBe(true);
      expect(result.isDesktop).toBe(false);
    });

    it('deve retornar isDesktop=true para largura >= 1024', () => {
      const result = createResponsiveStyles(1200);

      expect(result.isMobile).toBe(false);
      expect(result.isTablet).toBe(false);
      expect(result.isDesktop).toBe(true);
    });

    it('deve retornar isTablet=true para largura exatamente 768', () => {
      const result = createResponsiveStyles(768);

      expect(result.isTablet).toBe(true);
    });

    it('deve retornar isDesktop=true para largura exatamente 1024', () => {
      const result = createResponsiveStyles(1024);

      expect(result.isDesktop).toBe(true);
    });
  });

  describe('gridColumns', () => {
    it('deve retornar 1 coluna para mobile', () => {
      expect(createResponsiveStyles(375).gridColumns).toBe(1);
    });

    it('deve retornar 2 colunas para tablet', () => {
      expect(createResponsiveStyles(800).gridColumns).toBe(2);
    });

    it('deve retornar 4 colunas para desktop', () => {
      expect(createResponsiveStyles(1200).gridColumns).toBe(4);
    });
  });

  describe('containerMaxWidth', () => {
    it('deve retornar 100% para mobile', () => {
      expect(createResponsiveStyles(375).containerMaxWidth).toBe('100%');
    });

    it('deve retornar 100% para tablet', () => {
      expect(createResponsiveStyles(800).containerMaxWidth).toBe('100%');
    });

    it('deve retornar 1280 para desktop', () => {
      expect(createResponsiveStyles(1200).containerMaxWidth).toBe(1280);
    });
  });

  describe('paddingHorizontal', () => {
    it('deve retornar 16 para mobile', () => {
      expect(createResponsiveStyles(375).paddingHorizontal).toBe(16);
    });

    it('deve retornar 24 para tablet', () => {
      expect(createResponsiveStyles(800).paddingHorizontal).toBe(24);
    });

    it('deve retornar 32 para desktop', () => {
      expect(createResponsiveStyles(1200).paddingHorizontal).toBe(32);
    });
  });

  describe('cardWidth', () => {
    it('deve retornar 100% para mobile', () => {
      expect(createResponsiveStyles(375).cardWidth).toBe('100%');
    });

    it('deve retornar 48% para tablet', () => {
      expect(createResponsiveStyles(800).cardWidth).toBe('48%');
    });

    it('deve retornar 23% para desktop', () => {
      expect(createResponsiveStyles(1200).cardWidth).toBe('23%');
    });
  });

  describe('fontSize', () => {
    it('deve retornar tamanhos corretos para mobile', () => {
      const { fontSize } = createResponsiveStyles(375);

      expect(fontSize.h1).toBe(24);
      expect(fontSize.h2).toBe(20);
      expect(fontSize.h3).toBe(18);
      expect(fontSize.body).toBe(14);
      expect(fontSize.small).toBe(12);
    });

    it('deve retornar tamanhos corretos para tablet', () => {
      const { fontSize } = createResponsiveStyles(800);

      expect(fontSize.h1).toBe(28);
      expect(fontSize.h2).toBe(22);
      expect(fontSize.h3).toBe(20);
      expect(fontSize.body).toBe(16);
      expect(fontSize.small).toBe(14);
    });

    it('deve retornar tamanhos corretos para desktop', () => {
      const { fontSize } = createResponsiveStyles(1200);

      expect(fontSize.h1).toBe(32);
      expect(fontSize.h2).toBe(24);
      expect(fontSize.h3).toBe(20);
      expect(fontSize.body).toBe(16);
      expect(fontSize.small).toBe(14);
    });
  });

  describe('edge cases', () => {
    it('deve funcionar com largura 0', () => {
      const result = createResponsiveStyles(0);
      expect(result.isMobile).toBe(true);
    });

    it('deve funcionar com larguras muito grandes', () => {
      const result = createResponsiveStyles(4000);
      expect(result.isDesktop).toBe(true);
    });

    it('deve funcionar com largura exatamente no limite mobile/tablet', () => {
      const result767 = createResponsiveStyles(767);
      const result768 = createResponsiveStyles(768);

      expect(result767.isMobile).toBe(true);
      expect(result768.isTablet).toBe(true);
    });

    it('deve funcionar com largura exatamente no limite tablet/desktop', () => {
      const result1023 = createResponsiveStyles(1023);
      const result1024 = createResponsiveStyles(1024);

      expect(result1023.isTablet).toBe(true);
      expect(result1024.isDesktop).toBe(true);
    });
  });
});
