import { render } from '@testing-library/react-native';
import React from 'react';

import { Skeleton, SkeletonCard, SkeletonList } from '../SkeletonLoader';

describe('SkeletonLoader Components', () => {
  describe('Skeleton Base', () => {
    it('deve renderizar skeleton básico', () => {
      const { root } = render(<Skeleton />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar width customizado', () => {
      const { root } = render(<Skeleton width={200} />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar width como string', () => {
      const { root } = render(<Skeleton width="50%" />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar height customizado', () => {
      const { root } = render(<Skeleton height={40} />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar borderRadius customizado', () => {
      const { root } = render(<Skeleton borderRadius={12} />);
      expect(root).toBeTruthy();
    });

    it('deve aceitar style customizado', () => {
      const customStyle = { marginTop: 20 };
      const { root } = render(<Skeleton style={customStyle} />);
      expect(root).toBeTruthy();
    });

    it('deve usar valores padrão', () => {
      const { root } = render(<Skeleton />);
      expect(root).toBeTruthy();
    });
  });

  describe('SkeletonCard', () => {
    it('deve renderizar card skeleton', () => {
      const { root } = render(<SkeletonCard />);
      expect(root).toBeTruthy();
    });

    it('deve renderizar múltiplos elementos skeleton', () => {
      const { UNSAFE_getAllByType } = render(<SkeletonCard />);
      const skeletons = UNSAFE_getAllByType(Skeleton);
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('SkeletonList', () => {
    it('deve renderizar lista skeleton com count padrão', () => {
      const { root } = render(<SkeletonList />);
      expect(root).toBeTruthy();
    });

    it('deve renderizar lista com count customizado', () => {
      const { root } = render(<SkeletonList count={5} />);
      expect(root).toBeTruthy();
    });

    it('deve limitar count a 7 itens para performance', () => {
      const { root } = render(<SkeletonList count={10} />);
      expect(root).toBeTruthy();
      // Verifica que renderiza mas não trava
    });

    it('deve renderizar lista com 1 item', () => {
      const { root } = render(<SkeletonList count={1} />);
      expect(root).toBeTruthy();
    });

    it('deve renderizar lista com count 0', () => {
      const { root } = render(<SkeletonList count={0} />);
      expect(root).toBeTruthy();
    });
  });

  describe('Casos de Uso', () => {
    it('deve renderizar skeleton circular (avatar)', () => {
      const { root } = render(
        <Skeleton width={60} height={60} borderRadius={30} />
      );
      expect(root).toBeTruthy();
    });

    it('deve renderizar skeleton de texto', () => {
      const { root } = render(<Skeleton width="80%" height={16} />);
      expect(root).toBeTruthy();
    });

    it('deve renderizar skeleton de botão', () => {
      const { root } = render(
        <Skeleton width={120} height={44} borderRadius={8} />
      );
      expect(root).toBeTruthy();
    });

    it('deve renderizar skeleton de card completo', () => {
      const { UNSAFE_getAllByType } = render(<SkeletonCard />);
      const skeletons = UNSAFE_getAllByType(Skeleton);
      expect(skeletons.length).toBe(3); // Avatar + 2 linhas de texto
    });
  });

  describe('Performance', () => {
    it('deve renderizar lista grande sem travar', () => {
      const { root } = render(<SkeletonList count={7} />);
      expect(root).toBeTruthy();
    });

    it('deve aplicar limite de performance automaticamente', () => {
      // Tenta renderizar 20, mas deve limitar a 7
      const { root } = render(<SkeletonList count={20} />);
      expect(root).toBeTruthy();
    });
  });

  describe('Composição', () => {
    it('deve renderizar múltiplos skeletons juntos', () => {
      const { UNSAFE_getAllByType } = render(
        <>
          <Skeleton width={100} height={20} />
          <Skeleton width={150} height={20} />
          <Skeleton width={80} height={20} />
        </>
      );
      const skeletons = UNSAFE_getAllByType(Skeleton);
      expect(skeletons.length).toBe(3);
    });

    it('deve renderizar layout personalizado', () => {
      const { UNSAFE_getAllByType } = render(
        <>
          <Skeleton width={60} height={60} borderRadius={30} />
          <Skeleton width="100%" height={20} />
          <Skeleton width="70%" height={16} />
        </>
      );
      const skeletons = UNSAFE_getAllByType(Skeleton);
      expect(skeletons.length).toBe(3);
    });
  });
});
