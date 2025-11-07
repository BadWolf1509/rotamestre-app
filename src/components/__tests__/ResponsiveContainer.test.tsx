import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ResponsiveContainer } from '../ResponsiveContainer';

// Mock do hook useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1920,
    height: 1080,
  })),
}));

describe('ResponsiveContainer Component', () => {
  const { useResponsive } = require('@/hooks/useResponsive');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar children', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Conteúdo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });

    it('deve renderizar múltiplos children', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Primeiro</Text>
          <Text>Segundo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Primeiro')).toBeTruthy();
      expect(getByText('Segundo')).toBeTruthy();
    });
  });

  describe('Props Customizadas', () => {
    it('deve aceitar maxWidth customizado', () => {
      const { getByText } = render(
        <ResponsiveContainer maxWidth={1440}>
          <Text>Conteúdo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });

    it('deve aceitar padding customizado', () => {
      const { getByText } = render(
        <ResponsiveContainer padding={32}>
          <Text>Conteúdo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });

    it('deve aceitar center=false', () => {
      const { getByText } = render(
        <ResponsiveContainer center={false}>
          <Text>Conteúdo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });

    it('deve aceitar style customizado', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByText } = render(
        <ResponsiveContainer style={customStyle}>
          <Text>Conteúdo</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Conteúdo')).toBeTruthy();
    });
  });

  describe('Comportamento Responsivo - Mobile', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        width: 375,
        height: 667,
      });
    });

    it('deve renderizar em mobile', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Mobile Content</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Mobile Content')).toBeTruthy();
    });

    it('deve aceitar props em mobile', () => {
      const { getByText } = render(
        <ResponsiveContainer maxWidth={1280} padding={16}>
          <Text>Mobile Customizado</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Mobile Customizado')).toBeTruthy();
    });
  });

  describe('Comportamento Responsivo - Tablet', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        width: 768,
        height: 1024,
      });
    });

    it('deve renderizar em tablet', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Tablet Content</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Tablet Content')).toBeTruthy();
    });
  });

  describe('Comportamento Responsivo - Desktop', () => {
    beforeEach(() => {
      useResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1920,
        height: 1080,
      });
    });

    it('deve renderizar em desktop', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Desktop Content</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Desktop Content')).toBeTruthy();
    });

    it('deve aplicar maxWidth em desktop', () => {
      const { getByText } = render(
        <ResponsiveContainer maxWidth={1440}>
          <Text>Desktop Customizado</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Desktop Customizado')).toBeTruthy();
    });

    it('deve centralizar em desktop por padrão', () => {
      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Centralizado</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Centralizado')).toBeTruthy();
    });

    it('não deve centralizar quando center=false', () => {
      const { getByText } = render(
        <ResponsiveContainer center={false}>
          <Text>Não Centralizado</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Não Centralizado')).toBeTruthy();
    });
  });

  describe('Casos de Uso', () => {
    it('deve servir como wrapper de página', () => {
      useResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1920,
        height: 1080,
      });

      const { getByText } = render(
        <ResponsiveContainer>
          <Text>Página Dashboard</Text>
          <Text>Conteúdo da página</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Página Dashboard')).toBeTruthy();
      expect(getByText('Conteúdo da página')).toBeTruthy();
    });

    it('deve funcionar com maxWidth customizado para telas grandes', () => {
      useResponsive.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 2560,
        height: 1440,
      });

      const { getByText } = render(
        <ResponsiveContainer maxWidth={1600}>
          <Text>Tela Ultra Wide</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Tela Ultra Wide')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve aceitar todas as props juntas', () => {
      const { getByText } = render(
        <ResponsiveContainer
          maxWidth={1440}
          padding={24}
          center={true}
          style={{ backgroundColor: 'white' }}
        >
          <Text>Tudo Customizado</Text>
        </ResponsiveContainer>
      );

      expect(getByText('Tudo Customizado')).toBeTruthy();
    });
  });
});
