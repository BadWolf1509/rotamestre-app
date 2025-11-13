import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  ListRenderItem,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
  ViewToken,
  VirtualizedList,
  FlatList,
} from 'react-native';

import { defaultTheme } from '@/utils/styles';

interface OptimizedListProps<T> {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  type?: 'flat' | 'section' | 'flash';
  estimatedItemSize?: number;
  initialNumToRender?: number;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  removeClippedSubviews?: boolean;
  updateCellsBatchingPeriod?: number;
  onEndReachedThreshold?: number;
  onEndReached?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement;
  ItemSeparatorComponent?: React.ComponentType<any> | React.ReactElement;
  onViewableItemsChanged?: (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => void;
  getItemLayout?: (data: T[] | null | undefined, index: number) => { length: number; offset: number; index: number };
  horizontal?: boolean;
  numColumns?: number;
  columnWrapperStyle?: any;
  contentContainerStyle?: any;
  style?: any;
  enableOptimizations?: boolean;
}

function OptimizedListComponent<T>({
  data,
  renderItem,
  keyExtractor,
  type = 'flash',
  estimatedItemSize = 100,
  initialNumToRender,
  maxToRenderPerBatch,
  windowSize,
  removeClippedSubviews = true,
  updateCellsBatchingPeriod = 50,
  onEndReachedThreshold = 0.5,
  onEndReached,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  onViewableItemsChanged,
  getItemLayout,
  horizontal = false,
  numColumns = 1,
  columnWrapperStyle,
  contentContainerStyle,
  style,
  enableOptimizations = true,
}: OptimizedListProps<T>) {
  const listRef = useRef<any>(null);
  const viewabilityConfigRef = useRef({
    minimumViewTime: 100,
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: true,
  });

  // Memoized render item with performance tracking
  const optimizedRenderItem = useCallback<ListRenderItem<T>>(
    (info) => {
      const startTime = Date.now();
      const result = renderItem(info);

      if (enableOptimizations && Platform.OS === 'web') {
        // Track render time for web
        requestAnimationFrame(() => {
          const renderTime = Date.now() - startTime;
          if (renderTime > 16) { // More than one frame (16ms)
            console.warn(`Slow render detected for item ${info.index}: ${renderTime}ms`);
          }
        });
      }

      return result;
    },
    [renderItem, enableOptimizations]
  );

  // Memoized key extractor
  const memoizedKeyExtractor = useCallback(
    (item: T, index: number) => keyExtractor(item, index),
    [keyExtractor]
  );

  // Optimized onEndReached handler with debouncing
  const debouncedOnEndReached = useMemo(() => {
    if (!onEndReached) return undefined;

    let timeout: ReturnType<typeof setTimeout>;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        onEndReached();
      }, 200);
    };
  }, [onEndReached]);

  // Calculate optimized props based on data size
  const getOptimizedProps = () => {
    const dataLength = data.length;
    const baseProps = {
      initialNumToRender: initialNumToRender || Math.min(10, dataLength),
      maxToRenderPerBatch: maxToRenderPerBatch || 5,
      windowSize: windowSize || 10,
      updateCellsBatchingPeriod,
      removeClippedSubviews: Platform.OS === 'android' ? removeClippedSubviews : false,
    };

    // Adjust based on data size
    if (dataLength > 100) {
      return {
        ...baseProps,
        initialNumToRender: Math.min(5, dataLength),
        maxToRenderPerBatch: 3,
        windowSize: 5,
      };
    } else if (dataLength > 50) {
      return {
        ...baseProps,
        initialNumToRender: Math.min(7, dataLength),
        maxToRenderPerBatch: 4,
        windowSize: 7,
      };
    }

    return baseProps;
  };

  const optimizedProps = enableOptimizations ? getOptimizedProps() : {
    initialNumToRender,
    maxToRenderPerBatch,
    windowSize,
    updateCellsBatchingPeriod,
    removeClippedSubviews,
  };

  // Empty state component
  const EmptyComponent = useCallback(() => {
    if (ListEmptyComponent) {
      return typeof ListEmptyComponent === 'function' ?
        <ListEmptyComponent /> : ListEmptyComponent;
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhum item encontrado</Text>
      </View>
    );
  }, [ListEmptyComponent]);

  // Refresh control
  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[defaultTheme.colors.primary]}
      tintColor={defaultTheme.colors.primary}
    />
  ) : undefined;

  // Common list props
  const commonProps = {
    ref: listRef,
    data,
    renderItem: optimizedRenderItem,
    keyExtractor: memoizedKeyExtractor,
    horizontal,
    contentContainerStyle,
    style,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent: EmptyComponent,
    ItemSeparatorComponent,
    onEndReached: debouncedOnEndReached,
    onEndReachedThreshold,
    refreshControl,
    showsVerticalScrollIndicator: !horizontal,
    showsHorizontalScrollIndicator: horizontal,
    ...optimizedProps,
  };

  // Use FlashList for best performance (only on native)
  if (type === 'flash' && Platform.OS !== 'web') {
    return (
      <FlashList
        {...commonProps}
        estimatedItemSize={estimatedItemSize}
        viewabilityConfig={viewabilityConfigRef.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={getItemLayout}
        drawDistance={200}
        estimatedListSize={{
          height: 600,
          width: horizontal ? undefined : 400,
        }}
      />
    );
  }

  // Use FlatList as fallback
  if (type === 'flat' || numColumns > 1) {
    return (
      <FlatList
        {...commonProps}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? columnWrapperStyle : undefined}
        viewabilityConfig={viewabilityConfigRef.current}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={getItemLayout}
        legacyImplementation={false}
        maintainVisibleContentPosition={
          Platform.OS === 'ios'
            ? {
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 100,
              }
            : undefined
        }
      />
    );
  }

  // Default to VirtualizedList for maximum control
  return (
    <VirtualizedList
      {...commonProps}
      getItemCount={() => data.length}
      getItem={(items: T[], index: number) => items[index]}
      viewabilityConfig={viewabilityConfigRef.current}
      onViewableItemsChanged={onViewableItemsChanged}
      getItemLayout={getItemLayout}
    />
  );
}

// Memoized component to prevent unnecessary re-renders
export const OptimizedList = memo(OptimizedListComponent) as typeof OptimizedListComponent;

// Helper component for section lists
interface OptimizedSectionListProps<T> {
  sections: Array<{
    title: string;
    data: T[];
  }>;
  renderItem: ListRenderItem<T>;
  renderSectionHeader?: (info: { section: any }) => React.ReactElement | null;
  keyExtractor: (item: T, index: number) => string;
  stickySectionHeadersEnabled?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement;
  ItemSeparatorComponent?: React.ComponentType<any> | React.ReactElement;
  SectionSeparatorComponent?: React.ComponentType<any> | React.ReactElement;
  contentContainerStyle?: any;
  style?: any;
}

export function OptimizedSectionList<T>({
  sections,
  renderItem,
  renderSectionHeader,
  keyExtractor,
  stickySectionHeadersEnabled = true,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  SectionSeparatorComponent,
  contentContainerStyle,
  style,
}: OptimizedSectionListProps<T>) {
  const optimizedRenderItem = useCallback<ListRenderItem<T>>(
    (info) => renderItem(info),
    [renderItem]
  );

  const optimizedRenderSectionHeader = useCallback(
    (info: { section: any }) => {
      if (!renderSectionHeader) {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{info.section.title}</Text>
          </View>
        );
      }
      return renderSectionHeader(info);
    },
    [renderSectionHeader]
  );

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[defaultTheme.colors.primary]}
      tintColor={defaultTheme.colors.primary}
    />
  ) : undefined;

  return (
    <SectionList
      sections={sections}
      renderItem={optimizedRenderItem}
      renderSectionHeader={optimizedRenderSectionHeader}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled={stickySectionHeadersEnabled}
      refreshControl={refreshControl}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      ItemSeparatorComponent={ItemSeparatorComponent}
      SectionSeparatorComponent={SectionSeparatorComponent}
      contentContainerStyle={contentContainerStyle}
      style={style}
      showsVerticalScrollIndicator={false}
      initialNumToRender={5}
      maxToRenderPerBatch={3}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      updateCellsBatchingPeriod={50}
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  sectionHeader: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
