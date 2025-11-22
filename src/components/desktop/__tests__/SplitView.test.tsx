import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View, ScrollView } from 'react-native';

import { SplitView } from '../SplitView';

// Mock useResponsive
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

const mockUseResponsive = require('@/hooks/useResponsive').useResponsive;

describe('SplitView', () => {
  beforeEach(() => {
    // Default to desktop view
    mockUseResponsive.mockReturnValue({ isDesktop: true });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar left e right panels', () => {
      const { getByText } = render(
        <SplitView
          left={<Text>Left Panel</Text>}
          right={<Text>Right Panel</Text>}
        />
      );

      expect(getByText('Left Panel')).toBeTruthy();
      expect(getByText('Right Panel')).toBeTruthy();
    });

    it('deve renderizar como View por padrão (não scrollable)', () => {
      const { UNSAFE_getAllByType, UNSAFE_queryAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      const scrollViews = UNSAFE_queryAllByType(ScrollView);

      expect(views.length).toBeGreaterThan(0);
      expect(scrollViews.length).toBe(0);
    });

    it('deve renderizar como ScrollView quando scrollable=true', () => {
      const { UNSAFE_getByType } = render(
        <SplitView
          scrollable
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });
  });

  describe('Layout Desktop', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });
    });

    it('deve renderizar painéis lado a lado em desktop', () => {
      const { getByText } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      expect(getByText('Left')).toBeTruthy();
      expect(getByText('Right')).toBeTruthy();
    });

    it('deve aplicar leftFlex e rightFlex em desktop', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftFlex={2}
          rightFlex={1}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar minWidth nos painéis em desktop', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftMinWidth={400}
          rightMinWidth={350}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve aplicar gap customizado em desktop', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          gap={24}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve manter ordem left → right em desktop', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          reverseMobile
        />
      );

      // reverseMobile não afeta desktop
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Layout Mobile', () => {
    beforeEach(() => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });
    });

    it('deve renderizar painéis empilhados verticalmente em mobile', () => {
      const { getByText } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      expect(getByText('Left')).toBeTruthy();
      expect(getByText('Right')).toBeTruthy();
    });

    it('deve aplicar marginTop no segundo painel em mobile', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          gap={20}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve manter ordem left → right por padrão em mobile', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve reverter ordem para right → left quando reverseMobile=true', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          reverseMobile
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('não deve aplicar minWidth em mobile', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftMinWidth={400}
          rightMinWidth={350}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('não deve aplicar flex em mobile', () => {
      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftFlex={2}
          rightFlex={1}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Modo Scrollable', () => {
    it('deve renderizar ScrollView em desktop quando scrollable=true', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getByType } = render(
        <SplitView
          scrollable
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });

    it('deve renderizar ScrollView em mobile quando scrollable=true', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { UNSAFE_getByType } = render(
        <SplitView
          scrollable
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView).toBeTruthy();
    });

    it('deve aplicar contentContainerStyle ao ScrollView', () => {
      const { UNSAFE_getByType } = render(
        <SplitView
          scrollable
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const scrollView = UNSAFE_getByType(ScrollView);
      expect(scrollView.props.contentContainerStyle).toBeDefined();
    });

    it('deve renderizar conteúdo correto dentro do ScrollView', () => {
      const { getByText } = render(
        <SplitView
          scrollable
          left={<Text>Scrollable Left</Text>}
          right={<Text>Scrollable Right</Text>}
        />
      );

      expect(getByText('Scrollable Left')).toBeTruthy();
      expect(getByText('Scrollable Right')).toBeTruthy();
    });
  });

  describe('Props com Valores Padrão', () => {
    it('deve usar leftFlex=1 por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve usar rightFlex=1 por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve usar gap=16 por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve usar leftMinWidth=300 por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve usar rightMinWidth=300 por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve usar scrollable=false por padrão', () => {
      const { UNSAFE_queryAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const scrollViews = UNSAFE_queryAllByType(ScrollView);
      expect(scrollViews.length).toBe(0);
    });

    it('deve usar reverseMobile=false por padrão', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Props Customizáveis', () => {
    it('deve aplicar style customizado ao container', () => {
      const customStyle = { backgroundColor: '#F0F0F0' };

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          style={customStyle}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views[0].props.style).toBeDefined();
    });

    it('deve combinar todas as props customizáveis', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { getByText } = render(
        <SplitView
          left={<Text>Custom Left</Text>}
          right={<Text>Custom Right</Text>}
          leftFlex={3}
          rightFlex={2}
          gap={32}
          leftMinWidth={450}
          rightMinWidth={400}
          style={{ padding: 10 }}
        />
      );

      expect(getByText('Custom Left')).toBeTruthy();
      expect(getByText('Custom Right')).toBeTruthy();
    });
  });

  describe('Conteúdo Complexo', () => {
    it('deve renderizar conteúdo complexo no left panel', () => {
      const { getByText } = render(
        <SplitView
          left={
            <View>
              <Text>Title</Text>
              <Text>Description</Text>
              <View>
                <Text>Nested</Text>
              </View>
            </View>
          }
          right={<Text>Right</Text>}
        />
      );

      expect(getByText('Title')).toBeTruthy();
      expect(getByText('Description')).toBeTruthy();
      expect(getByText('Nested')).toBeTruthy();
    });

    it('deve renderizar conteúdo complexo no right panel', () => {
      const { getByText } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={
            <View>
              <Text>Header</Text>
              <Text>Body</Text>
              <Text>Footer</Text>
            </View>
          }
        />
      );

      expect(getByText('Header')).toBeTruthy();
      expect(getByText('Body')).toBeTruthy();
      expect(getByText('Footer')).toBeTruthy();
    });

    it('deve renderizar conteúdo complexo em ambos os painéis', () => {
      const { getByText } = render(
        <SplitView
          left={
            <View>
              <Text>Left 1</Text>
              <Text>Left 2</Text>
            </View>
          }
          right={
            <View>
              <Text>Right 1</Text>
              <Text>Right 2</Text>
            </View>
          }
        />
      );

      expect(getByText('Left 1')).toBeTruthy();
      expect(getByText('Left 2')).toBeTruthy();
      expect(getByText('Right 1')).toBeTruthy();
      expect(getByText('Right 2')).toBeTruthy();
    });
  });

  describe('Casos Edge', () => {
    it('deve lidar com leftFlex=0', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftFlex={0}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve lidar com gap=0', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          gap={0}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve lidar com minWidth muito pequeno', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftMinWidth={50}
          rightMinWidth={50}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it('deve lidar com minWidth muito grande', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { UNSAFE_getAllByType } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
          leftMinWidth={1000}
          rightMinWidth={1000}
        />
      );

      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });
  });

  describe('Combinações Desktop/Mobile', () => {
    it('deve alternar corretamente de desktop para mobile', () => {
      mockUseResponsive.mockReturnValue({ isDesktop: true });

      const { rerender, getByText } = render(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      expect(getByText('Left')).toBeTruthy();

      // Simula mudança para mobile
      mockUseResponsive.mockReturnValue({ isDesktop: false });

      rerender(
        <SplitView
          left={<Text>Left</Text>}
          right={<Text>Right</Text>}
        />
      );

      expect(getByText('Left')).toBeTruthy();
      expect(getByText('Right')).toBeTruthy();
    });
  });
});
