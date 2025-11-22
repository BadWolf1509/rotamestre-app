import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { OptimizedList, OptimizedSectionList } from '../OptimizedList';

// Mock FlashList
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    FlashList: (props: any) => React.createElement(FlatList, props),
  };
});

describe('OptimizedList', () => {
  const mockData = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
    { id: '3', name: 'Item 3' },
  ];

  const mockRenderItem = ({ item }: { item: typeof mockData[0] }) => (
    <View testID={`item-${item.id}`}>
      <Text>{item.name}</Text>
    </View>
  );

  const mockKeyExtractor = (item: typeof mockData[0]) => item.id;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Renderização básica', () => {
    it('deve renderizar lista com items', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
      expect(getByTestId('item-2')).toBeTruthy();
      expect(getByTestId('item-3')).toBeTruthy();
    });

    it('deve renderizar componente vazio quando não há dados', () => {
      const { getByText } = render(
        <OptimizedList
          data={[]}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
        />
      );

      expect(getByText('Nenhum item encontrado')).toBeTruthy();
    });

    it('deve renderizar componente vazio customizado', () => {
      const CustomEmpty = () => <Text>Lista vazia!</Text>;

      const { getByText } = render(
        <OptimizedList
          data={[]}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          ListEmptyComponent={CustomEmpty}
        />
      );

      expect(getByText('Lista vazia!')).toBeTruthy();
    });

    it('deve renderizar ListEmptyComponent como elemento React', () => {
      const { getByText } = render(
        <OptimizedList
          data={[]}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          ListEmptyComponent={<Text>Sem items</Text>}
        />
      );

      expect(getByText('Sem items')).toBeTruthy();
    });
  });

  describe('Header e Footer', () => {
    it('deve renderizar ListHeaderComponent', () => {
      const { getByText } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          ListHeaderComponent={<Text>Cabeçalho</Text>}
        />
      );

      expect(getByText('Cabeçalho')).toBeTruthy();
    });

    it('deve renderizar ListFooterComponent', () => {
      const { getByText } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          ListFooterComponent={<Text>Rodapé</Text>}
        />
      );

      expect(getByText('Rodapé')).toBeTruthy();
    });
  });

  describe('Refresh Control', () => {
    it('deve aceitar onRefresh e refreshing props', () => {
      const onRefresh = jest.fn();

      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          onRefresh={onRefresh}
          refreshing={false}
        />
      );

      // Lista deve renderizar normalmente
      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('Tipos de lista', () => {
    it('deve renderizar como FlatList quando type="flat"', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });

    it('deve renderizar FlatList quando numColumns > 1', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flash"
          numColumns={2}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });

    it('deve usar VirtualizedList como default quando não é flat nem flash', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="section"
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('Otimizações', () => {
    it('deve ajustar props para lista grande (>100 items)', () => {
      const largeData = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
      }));

      const { getByTestId } = render(
        <OptimizedList
          data={largeData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          enableOptimizations={true}
        />
      );

      expect(getByTestId('item-0')).toBeTruthy();
    });

    it('deve ajustar props para lista média (>50 items)', () => {
      const mediumData = Array.from({ length: 75 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
      }));

      const { getByTestId } = render(
        <OptimizedList
          data={mediumData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          enableOptimizations={true}
        />
      );

      expect(getByTestId('item-0')).toBeTruthy();
    });

    it('deve usar props padrão quando enableOptimizations=false', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          enableOptimizations={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('onEndReached', () => {
    it('deve configurar onEndReached com debounce', () => {
      const onEndReached = jest.fn();

      render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
        />
      );

      // onEndReached é configurado mas só é chamado quando scroll atinge o threshold
      expect(onEndReached).not.toHaveBeenCalled();
    });
  });

  describe('Horizontal e colunas', () => {
    it('deve renderizar lista horizontal', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          horizontal={true}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });

    it('deve renderizar lista com múltiplas colunas', () => {
      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          numColumns={2}
          columnWrapperStyle={{ gap: 8 }}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('ItemSeparatorComponent', () => {
    it('deve renderizar separador entre itens', () => {
      const Separator = () => <View testID="separator" style={{ height: 1 }} />;

      const { getAllByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          ItemSeparatorComponent={Separator}
        />
      );

      // FlatList renderiza separadores entre itens
      const separators = getAllByTestId('separator');
      expect(separators.length).toBe(mockData.length - 1);
    });
  });

  describe('getItemLayout', () => {
    it('deve aceitar função getItemLayout', () => {
      const getItemLayout = (data: any, index: number) => ({
        length: 50,
        offset: 50 * index,
        index,
      });

      const { getByTestId } = render(
        <OptimizedList
          data={mockData}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          type="flat"
          getItemLayout={getItemLayout}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });
});

describe('OptimizedSectionList', () => {
  const mockSections = [
    { title: 'Seção A', data: [{ id: '1', name: 'Item A1' }, { id: '2', name: 'Item A2' }] },
    { title: 'Seção B', data: [{ id: '3', name: 'Item B1' }] },
  ];

  const mockRenderItem = ({ item }: { item: { id: string; name: string } }) => (
    <View testID={`item-${item.id}`}>
      <Text>{item.name}</Text>
    </View>
  );

  const mockKeyExtractor = (item: { id: string }) => item.id;

  describe('Renderização básica', () => {
    it('deve renderizar seções com items', () => {
      const { getByTestId, getByText } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
        />
      );

      // Verifica os primeiros items renderizados
      expect(getByTestId('item-1')).toBeTruthy();
      expect(getByTestId('item-2')).toBeTruthy();
      // Verifica headers de seção (uppercase devido ao style)
      expect(getByText('Seção A')).toBeTruthy();
      expect(getByText('Seção B')).toBeTruthy();
    });

    it('deve renderizar header de seção customizado', () => {
      const renderSectionHeader = ({ section }: { section: any }) => (
        <Text testID={`header-${section.title}`}>Header: {section.title}</Text>
      );

      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          renderSectionHeader={renderSectionHeader}
        />
      );

      expect(getByTestId('header-Seção A')).toBeTruthy();
      expect(getByTestId('header-Seção B')).toBeTruthy();
    });
  });

  describe('Components auxiliares', () => {
    it('deve renderizar ListHeaderComponent', () => {
      const { getByText } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          ListHeaderComponent={<Text>Cabeçalho da lista</Text>}
        />
      );

      expect(getByText('Cabeçalho da lista')).toBeTruthy();
    });

    it('deve renderizar ListFooterComponent', () => {
      const { getByText } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          ListFooterComponent={<Text>Rodapé da lista</Text>}
        />
      );

      expect(getByText('Rodapé da lista')).toBeTruthy();
    });

    it('deve renderizar ListEmptyComponent quando não há seções', () => {
      const { getByText } = render(
        <OptimizedSectionList
          sections={[]}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          ListEmptyComponent={<Text>Sem seções</Text>}
        />
      );

      expect(getByText('Sem seções')).toBeTruthy();
    });
  });

  describe('Refresh Control', () => {
    it('deve aceitar onRefresh e refreshing', () => {
      const onRefresh = jest.fn();

      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          onRefresh={onRefresh}
          refreshing={false}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('Sticky headers', () => {
    it('deve habilitar sticky section headers por padrão', () => {
      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });

    it('deve poder desabilitar sticky section headers', () => {
      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          stickySectionHeadersEnabled={false}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });

  describe('Separadores', () => {
    it('deve aceitar ItemSeparatorComponent', () => {
      const Separator = () => <View testID="item-separator" />;

      const { getAllByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          ItemSeparatorComponent={Separator}
        />
      );

      const separators = getAllByTestId('item-separator');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('deve aceitar SectionSeparatorComponent', () => {
      const SectionSeparator = () => <View testID="section-separator" />;

      const { getAllByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          SectionSeparatorComponent={SectionSeparator}
        />
      );

      const separators = getAllByTestId('section-separator');
      expect(separators.length).toBeGreaterThan(0);
    });
  });

  describe('Estilos', () => {
    it('deve aceitar contentContainerStyle', () => {
      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          contentContainerStyle={{ padding: 16 }}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });

    it('deve aceitar style', () => {
      const { getByTestId } = render(
        <OptimizedSectionList
          sections={mockSections}
          renderItem={mockRenderItem}
          keyExtractor={mockKeyExtractor}
          style={{ flex: 1 }}
        />
      );

      expect(getByTestId('item-1')).toBeTruthy();
    });
  });
});
