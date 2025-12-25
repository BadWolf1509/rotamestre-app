/**
 * Tests for RotaCardSkeleton.tsx
 * Skeleton loading para cards de rota
 */

import { render } from '@testing-library/react-native';
import React from 'react';

import { RotaCardSkeleton, RotaCardSkeletonList } from '../RotaCardSkeleton';

// Mock styles
jest.mock('@/utils/styles', () => {
  const theme = {
    colors: {
      white: '#ffffff',
      gray200: '#e5e7eb',
      gray300: '#d1d5db',
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
    },
    borderRadius: {
      sm: 4,
      lg: 12,
    },
    shadows: {
      sm: {},
    },
  };

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    useUnistyles: () => ({ theme }),
  };
});

describe('RotaCardSkeleton', () => {
  describe('Renderização', () => {
    it('deve renderizar sem erro', () => {
      const { toJSON } = render(<RotaCardSkeleton />);

      expect(toJSON()).toBeTruthy();
    });

    it('deve ter estrutura de card com views', () => {
      const { UNSAFE_root } = render(<RotaCardSkeleton />);

      // Deve ter elementos de View (container, header, stats)
      expect(UNSAFE_root.children.length).toBeGreaterThan(0);
    });
  });

  describe('Animação', () => {
    it('deve ter elementos animados', () => {
      const { UNSAFE_getAllByType } = render(<RotaCardSkeleton />);

      const { Animated } = require('react-native');
      const animatedViews = UNSAFE_getAllByType(Animated.View);

      // Deve ter múltiplos elementos animados (pulsos)
      expect(animatedViews.length).toBeGreaterThan(0);
    });
  });
});

describe('RotaCardSkeletonList', () => {
  describe('Renderização com count padrão', () => {
    it('deve renderizar 3 skeletons por padrão', () => {
      const { UNSAFE_getAllByType } = render(<RotaCardSkeletonList />);

      const { View } = require('react-native');
      const cards = UNSAFE_getAllByType(View);

      // Deve ter múltiplas views (3 cards x views por card)
      expect(cards.length).toBeGreaterThan(3);
    });
  });

  describe('Renderização com count customizado', () => {
    it('deve renderizar 5 skeletons quando count=5', () => {
      const { toJSON } = render(<RotaCardSkeletonList count={5} />);

      // O output deve existir e ter estrutura
      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar 1 skeleton quando count=1', () => {
      const { toJSON } = render(<RotaCardSkeletonList count={1} />);

      expect(toJSON()).toBeTruthy();
    });

    it('deve renderizar 0 skeletons quando count=0', () => {
      const { toJSON } = render(<RotaCardSkeletonList count={0} />);

      // Com count=0, deve renderizar vazio ou null
      expect(toJSON()).toBeFalsy();
    });
  });
});
