/**
 * Tests for StepIndicator component
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { StepIndicator, type Step } from '../StepIndicator';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isDesktop: false,
    isMobile: true,
    isTablet: false,
  }),
}));

const mockSteps: Step[] = [
  { id: 'step1', title: 'Primeiro' },
  { id: 'step2', title: 'Segundo' },
  { id: 'step3', title: 'Terceiro' },
  { id: 'step4', title: 'Quarto' },
];

describe('StepIndicator', () => {
  describe('Renderização básica', () => {
    it('deve renderizar todos os passos', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
    });

    it('deve renderizar com 2 passos', () => {
      const twoSteps = [
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ];
      render(<StepIndicator steps={twoSteps} currentStep={0} />);

      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    });
  });

  describe('Indicação de progresso', () => {
    it('deve mostrar checkmark em passos completados', () => {
      const { UNSAFE_getAllByType } = render(
        <StepIndicator steps={mockSteps} currentStep={2} />
      );

      // Ionicons são renderizados como checkmarks para passos completados
      const ionicons = UNSAFE_getAllByType('Ionicons');
      const checkmarks = ionicons.filter((icon) => icon.props.name === 'checkmark');

      // Passos 0 e 1 devem ter checkmark (são anteriores ao passo atual 2)
      expect(checkmarks.length).toBe(2);
    });

    it('deve mostrar número no passo atual', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      // Passo atual (2) deve mostrar número
      expect(screen.getByText('2')).toBeTruthy();
    });

    it('deve mostrar número em passos pendentes', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      // Todos os passos devem mostrar números quando estamos no primeiro
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
    });
  });

  describe('Títulos', () => {
    it('não deve mostrar títulos por padrão', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      expect(screen.queryByText('Primeiro')).toBeNull();
      expect(screen.queryByText('Segundo')).toBeNull();
    });

    it('deve mostrar títulos quando showTitles=true', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} showTitles />);

      expect(screen.getByText('Primeiro')).toBeTruthy();
      expect(screen.getByText('Segundo')).toBeTruthy();
      expect(screen.getByText('Terceiro')).toBeTruthy();
      expect(screen.getByText('Quarto')).toBeTruthy();
    });
  });

  describe('Acessibilidade', () => {
    it('deve renderizar com props de acessibilidade', () => {
      const { toJSON } = render(
        <StepIndicator steps={mockSteps} currentStep={1} />
      );

      // Componente renderiza corretamente
      expect(toJSON()).not.toBeNull();
    });

    it('deve aceitar accessibilityLabel customizado', () => {
      const { toJSON } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          accessibilityLabel="Etapa 1 de 4: Categoria"
        />
      );

      // Componente renderiza com label customizado sem erros
      expect(toJSON()).not.toBeNull();
    });
  });

  describe('Customização', () => {
    it('deve aceitar circleSize customizado', () => {
      const { UNSAFE_root } = render(
        <StepIndicator steps={mockSteps} currentStep={0} circleSize={40} />
      );

      // Verifica se o componente renderiza sem erros com tamanho customizado
      expect(UNSAFE_root).toBeTruthy();
    });

    it('deve aceitar lineHeight customizado', () => {
      const { UNSAFE_root } = render(
        <StepIndicator steps={mockSteps} currentStep={0} lineHeight={4} />
      );

      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Estados dos passos', () => {
    it('primeiro passo ativo', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      // Deve ter número 1 visível (passo ativo)
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('último passo ativo', () => {
      const { UNSAFE_getAllByType } = render(
        <StepIndicator steps={mockSteps} currentStep={3} />
      );

      // Deve ter 3 checkmarks (passos 0, 1, 2 completados)
      const ionicons = UNSAFE_getAllByType('Ionicons');
      const checkmarks = ionicons.filter((icon) => icon.props.name === 'checkmark');
      expect(checkmarks.length).toBe(3);

      // Deve ter número 4 visível (último passo)
      expect(screen.getByText('4')).toBeTruthy();
    });

    it('todos os passos completados', () => {
      const { UNSAFE_getAllByType } = render(
        <StepIndicator steps={mockSteps} currentStep={4} />
      );

      // Quando currentStep > último índice, todos devem ter checkmark
      const ionicons = UNSAFE_getAllByType('Ionicons');
      const checkmarks = ionicons.filter((icon) => icon.props.name === 'checkmark');
      expect(checkmarks.length).toBe(4);
    });
  });
});
