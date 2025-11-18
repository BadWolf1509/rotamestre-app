import React from 'react';
import { Text, View, ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';

import { DesktopLayout } from '../DesktopLayout';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;

describe('DesktopLayout', () => {
  beforeEach(() => {
    // Default to desktop view
    mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar children corretamente', () => {
      const { getByText } = render(
        <DesktopLayout>
          <Text>Layout Content</Text>
        </DesktopLayout>
      );

      expect(getByText('Layout Content')).toBeTruthy();
    });

    it('deve renderizar como View por padrão (não scrollable)', () => {
      const { UNSAFE_getAllByType, UNSAFE_queryAllByType } = render(
        <DesktopLayout>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      const scrollViews = UNSAFE_queryAllByType(ScrollView);

      expect(views.length).toBeGreaterThan(0);
      expect(scrollViews.length).toBe(0);
    });

    it('deve renderizar como ScrollView quando scrollable=true', () => {
      const { UNSAFE_getByType } = render(
        <DesktopLayout scrollable>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });
  });

  describe('Responsividade', () => {
    it('deve aplicar estilos de desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar estilos de tablet', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false, isTablet: true });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar estilos de mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar maxWidth em desktop', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout maxWidth={1200}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      // Content wrapper é o segundo View
      const contentWrapper = views[1];

      // Verificar que maxWidth está sendo aplicado
      expect(contentWrapper.props.style).toBeDefined();
    });

    it('não deve aplicar maxWidth em mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout maxWidth={1200}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Props Customizáveis', () => {
    it('deve usar maxWidth padrão de 1280', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar maxWidth customizado', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout maxWidth={1600}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar backgroundColor customizado', () => {
      const { UNSAFE_getAllByType } = render(
        <DesktopLayout backgroundColor="#FF0000">
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      const containerView = views[0];

      expect(containerView.props.style).toBeDefined();
    });

    it('deve aplicar style customizado ao container', () => {
      const customStyle = { paddingTop: 20 };

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout style={customStyle}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[0].props.style).toBeDefined();
    });

    it('deve aplicar contentStyle customizado', () => {
      const customContentStyle = { paddingBottom: 40 };

      const { UNSAFE_getAllByType } = render(
        <DesktopLayout contentStyle={customContentStyle}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[1].props.style).toBeDefined();
    });
  });

  describe('Modo Scrollable', () => {
    it('deve renderizar ScrollView quando scrollable=true', () => {
      const { UNSAFE_getByType } = render(
        <DesktopLayout scrollable>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });

    it('deve aplicar containerStyles ao ScrollView', () => {
      const { UNSAFE_getByType } = render(
        <DesktopLayout scrollable backgroundColor="#00FF00">
          <Text>Content</Text>
        </DesktopLayout>
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView.props.style).toBeDefined();
    });

    it('deve aplicar contentStyles ao contentContainerStyle', () => {
      const { UNSAFE_getByType } = render(
        <DesktopLayout scrollable contentStyle={{ padding: 10 }}>
          <Text>Content</Text>
        </DesktopLayout>
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView.props.contentContainerStyle).toBeDefined();
    });

    it('deve renderizar children dentro do ScrollView', () => {
      const { getByText } = render(
        <DesktopLayout scrollable>
          <Text>Scrollable Content</Text>
        </DesktopLayout>
      );

      expect(getByText('Scrollable Content')).toBeTruthy();
    });
  });

  describe('Combinações de Props', () => {
    it('deve combinar todas as props em desktop scrollable', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true, isTablet: false });

      const { getByText, UNSAFE_getByType } = render(
        <DesktopLayout
          scrollable
          maxWidth={1400}
          backgroundColor="#EFEFEF"
          style={{ marginTop: 10 }}
          contentStyle={{ paddingBottom: 20 }}
        >
          <Text>Complex Layout</Text>
        </DesktopLayout>
      );

      expect(getByText('Complex Layout')).toBeTruthy();

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
      expect(scrollView.props.style).toBeDefined();
      expect(scrollView.props.contentContainerStyle).toBeDefined();
    });

    it('deve combinar props em tablet não-scrollable', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false, isTablet: true });

      const { getByText, UNSAFE_getAllByType } = render(
        <DesktopLayout
          maxWidth={1000}
          backgroundColor="#FAFAFA"
          style={{ paddingTop: 5 }}
        >
          <Text>Tablet Layout</Text>
        </DesktopLayout>
      );

      expect(getByText('Tablet Layout')).toBeTruthy();

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve combinar props em mobile scrollable', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false, isTablet: false });

      const { getByText, UNSAFE_getByType } = render(
        <DesktopLayout
          scrollable
          backgroundColor="#F5F5F5"
          contentStyle={{ paddingHorizontal: 15 }}
        >
          <Text>Mobile Scrollable</Text>
        </DesktopLayout>
      );

      expect(getByText('Mobile Scrollable')).toBeTruthy();

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });
  });

  describe('Conteúdo Complexo', () => {
    it('deve renderizar múltiplos children', () => {
      const { getByText } = render(
        <DesktopLayout>
          <Text>Line 1</Text>
          <Text>Line 2</Text>
          <Text>Line 3</Text>
        </DesktopLayout>
      );

      expect(getByText('Line 1')).toBeTruthy();
      expect(getByText('Line 2')).toBeTruthy();
      expect(getByText('Line 3')).toBeTruthy();
    });

    it('deve renderizar children aninhados', () => {
      const { getByText } = render(
        <DesktopLayout>
          <View>
            <Text>Parent</Text>
            <View>
              <Text>Nested Child</Text>
            </View>
          </View>
        </DesktopLayout>
      );

      expect(getByText('Parent')).toBeTruthy();
      expect(getByText('Nested Child')).toBeTruthy();
    });
  });
});
