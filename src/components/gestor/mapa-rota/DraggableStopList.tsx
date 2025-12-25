/**
 * DraggableStopList - Lista de paradas com reordenação
 * Permite que gestores alterem a ordem das paradas em rotas pendentes/em_andamento
 *
 * Implementação híbrida:
 * - Mobile (iOS/Android): Drag-and-drop nativo via react-native-draggable-flatlist
 * - Web: Botões ↑↓ para mover paradas (drag não funciona bem na web)
 *
 * Restrições:
 * - Apenas paradas com status 'pendente' podem ser reordenadas
 * - Paradas concluídas/puladas ficam fixas no topo
 * - Base points (is_checkpoint === false) não são exibidos
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import type { Parada } from './types';

interface DraggableStopListProps {
  paradas: Parada[];
  onReorder: (newOrder: Parada[]) => Promise<void>;
  rotaStatus: string;
  isLoading?: boolean;
}

export function DraggableStopList({
  paradas,
  onReorder,
  rotaStatus,
  isLoading = false,
}: DraggableStopListProps) {
  const { theme } = useUnistyles();

  // Estado local para reordenação na web (permite preview antes de salvar)
  const [webReorderList, setWebReorderList] = useState<Parada[] | null>(null);
  const [hasWebChanges, setHasWebChanges] = useState(false);

  // Separar paradas fixas (concluídas/puladas) das reordenáveis
  const { fixedParadas, reorderableParadas } = useMemo(() => {
    // Filtrar apenas checkpoints (excluir base points)
    const checkpoints = paradas.filter((p) => p.is_checkpoint !== false);

    // Paradas fixas: já concluídas ou puladas
    const fixed = checkpoints
      .filter((p) => p.status === 'concluida' || p.status === 'pulada')
      .sort((a, b) => a.ordem - b.ordem);

    // Paradas reordenáveis: pendentes
    const reorderable = checkpoints
      .filter((p) => p.status === 'pendente')
      .sort((a, b) => a.ordem - b.ordem);

    return { fixedParadas: fixed, reorderableParadas: reorderable };
  }, [paradas]);

  // Lista atual para web (local ou original)
  const currentWebList = webReorderList || reorderableParadas;

  // Verificar se a reordenação é permitida
  const canReorder = rotaStatus === 'pendente' || rotaStatus === 'em_andamento';

  // Handler de reordenação (mobile - drag-and-drop)
  const handleDragEnd = useCallback(
    async ({ data }: { data: Parada[] }) => {
      if (!canReorder) return;

      // Recalcular ordem considerando as paradas fixas
      const newOrder = data.map((p, idx) => ({
        ...p,
        ordem: fixedParadas.length + idx + 1,
      }));

      await onReorder([...fixedParadas, ...newOrder]);
    },
    [canReorder, fixedParadas, onReorder]
  );

  // Handlers para web - mover parada para cima/baixo
  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const list = [...currentWebList];
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      setWebReorderList(list);
      setHasWebChanges(true);
    },
    [currentWebList]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= currentWebList.length - 1) return;
      const list = [...currentWebList];
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
      setWebReorderList(list);
      setHasWebChanges(true);
    },
    [currentWebList]
  );

  // Salvar alterações da web
  const handleSaveWebChanges = useCallback(async () => {
    if (!webReorderList || !hasWebChanges) return;

    const newOrder = webReorderList.map((p, idx) => ({
      ...p,
      ordem: fixedParadas.length + idx + 1,
    }));

    try {
      await onReorder([...fixedParadas, ...newOrder]);
      // Only clear state if save was successful
      setWebReorderList(null);
      setHasWebChanges(false);
    } catch (error) {
      // Error is handled by onReorder (handleReorderParadas)
      // Don't clear state so user can retry
      console.error('[DraggableStopList] Error saving:', error);
    }
  }, [webReorderList, hasWebChanges, fixedParadas, onReorder]);

  // Cancelar alterações da web
  const handleCancelWebChanges = useCallback(() => {
    setWebReorderList(null);
    setHasWebChanges(false);
  }, []);

  // Renderizar item fixo (não arrastável)
  const renderFixedItem = useCallback(
    (parada: Parada) => {
      const isCompleted = parada.status === 'concluida';
      const statusColor = isCompleted ? theme.colors.success : theme.colors.gray400;

      return (
        <View key={parada.id} style={styles.fixedItem}>
          <View style={[styles.orderBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.orderText}>{parada.ordem}</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.itemAddress} numberOfLines={1}>
              {parada.endereco}
            </Text>
            <View style={styles.statusRow}>
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={statusColor}
              />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {isCompleted ? 'Concluída' : 'Pulada'}
              </Text>
            </View>
          </View>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={16} color={theme.colors.gray400} />
          </View>
        </View>
      );
    },
    [theme]
  );

  // Renderizar item arrastável
  const renderDraggableItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<Parada>) => {
      const displayIndex = fixedParadas.length + reorderableParadas.indexOf(item) + 1;

      return (
        <ScaleDecorator>
          <View
            style={[
              styles.draggableItem,
              isActive && styles.draggableItemActive,
            ]}
          >
            {/* Handle de arraste */}
            <View
              style={styles.dragHandle}
              onTouchStart={drag}
              // @ts-ignore - onMouseDown para web
              onMouseDown={Platform.OS === 'web' ? drag : undefined}
            >
              <Ionicons
                name="reorder-three"
                size={24}
                color={isActive ? theme.colors.primary : theme.colors.gray400}
              />
            </View>

            {/* Número da ordem */}
            <View style={[styles.orderBadge, { backgroundColor: theme.colors.warning }]}>
              <Text style={styles.orderText}>{displayIndex}</Text>
            </View>

            {/* Conteúdo */}
            <View style={styles.itemContent}>
              <Text style={styles.itemAddress} numberOfLines={1}>
                {item.endereco}
              </Text>
              <View style={styles.metaRow}>
                {item.destinatario && (
                  <Text style={styles.metaText} numberOfLines={1}>
                    {item.destinatario}
                  </Text>
                )}
                <View
                  style={[
                    styles.typeTag,
                    item.tipo === 'entrega' ? styles.typeTagEntrega : styles.typeTagRetirada,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeTagText,
                      item.tipo === 'entrega'
                        ? styles.typeTagTextEntrega
                        : styles.typeTagTextRetirada,
                    ]}
                  >
                    {item.tipo === 'entrega' ? 'ENT' : 'RET'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Indicador de pendente */}
            <Ionicons name="time" size={16} color={theme.colors.warning} />
          </View>
        </ScaleDecorator>
      );
    },
    [fixedParadas.length, reorderableParadas, theme]
  );

  // Se não pode reordenar ou sem paradas, mostrar mensagem
  if (!canReorder) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="lock-closed-outline" size={32} color={theme.colors.gray400} />
        <Text style={styles.emptyText}>
          A ordem das paradas só pode ser alterada em rotas pendentes ou em andamento.
        </Text>
      </View>
    );
  }

  if (reorderableParadas.length === 0 && fixedParadas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="list-outline" size={32} color={theme.colors.gray400} />
        <Text style={styles.emptyText}>Nenhuma parada para reordenar.</Text>
      </View>
    );
  }

  // Renderizar item para web com botões ↑↓
  const renderWebItem = useCallback(
    (item: Parada, index: number) => {
      const displayIndex = fixedParadas.length + index + 1;
      const isFirst = index === 0;
      const isLast = index === currentWebList.length - 1;

      return (
        <View key={item.id} style={styles.draggableItem}>
          {/* Botões de mover */}
          <View style={styles.webMoveButtons}>
            <TouchableOpacity
              style={[styles.moveButton, isFirst && styles.moveButtonDisabled]}
              onPress={() => handleMoveUp(index)}
              disabled={isFirst}
            >
              <Ionicons
                name="chevron-up"
                size={18}
                color={isFirst ? theme.colors.gray300 : theme.colors.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveButton, isLast && styles.moveButtonDisabled]}
              onPress={() => handleMoveDown(index)}
              disabled={isLast}
            >
              <Ionicons
                name="chevron-down"
                size={18}
                color={isLast ? theme.colors.gray300 : theme.colors.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Número da ordem */}
          <View style={[styles.orderBadge, { backgroundColor: theme.colors.warning }]}>
            <Text style={styles.orderText}>{displayIndex}</Text>
          </View>

          {/* Conteúdo */}
          <View style={styles.itemContent}>
            <Text style={styles.itemAddress} numberOfLines={1}>
              {item.endereco}
            </Text>
            <View style={styles.metaRow}>
              {item.destinatario && (
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.destinatario}
                </Text>
              )}
              <View
                style={[
                  styles.typeTag,
                  item.tipo === 'entrega' ? styles.typeTagEntrega : styles.typeTagRetirada,
                ]}
              >
                <Text
                  style={[
                    styles.typeTagText,
                    item.tipo === 'entrega'
                      ? styles.typeTagTextEntrega
                      : styles.typeTagTextRetirada,
                  ]}
                >
                  {item.tipo === 'entrega' ? 'ENT' : 'RET'}
                </Text>
              </View>
            </View>
          </View>

          {/* Indicador de pendente */}
          <Ionicons name="time" size={16} color={theme.colors.warning} />
        </View>
      );
    },
    [fixedParadas.length, currentWebList.length, handleMoveUp, handleMoveDown, theme]
  );

  // ===== RENDER =====
  const isWeb = Platform.OS === 'web';

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Salvando nova ordem...</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="swap-vertical" size={20} color={theme.colors.secondary} />
        <Text style={styles.headerTitle}>Reordenar Paradas</Text>
        <Text style={styles.headerSubtitle}>
          {isWeb
            ? 'Use as setas para alterar a ordem'
            : 'Arraste as paradas para alterar a ordem'}
        </Text>
      </View>

      {/* Paradas fixas (concluídas/puladas) */}
      {fixedParadas.length > 0 && (
        <View style={styles.fixedSection}>
          <View style={styles.sectionLabelContainer}>
            <Ionicons name="lock-closed" size={12} color={theme.colors.gray500} />
            <Text style={styles.sectionLabelText}>Paradas finalizadas (ordem fixa)</Text>
          </View>
          {fixedParadas.map((parada) => renderFixedItem(parada))}
        </View>
      )}

      {/* Paradas reordenáveis - Web vs Mobile */}
      {(isWeb ? currentWebList : reorderableParadas).length > 0 && (
        <View style={styles.draggableSection}>
          <View style={styles.sectionLabelContainer}>
            <Ionicons
              name={isWeb ? 'swap-vertical' : 'hand-left'}
              size={12}
              color={theme.colors.warning}
            />
            <Text style={styles.sectionLabelText}>
              Paradas pendentes ({isWeb ? 'arraste para reordenar' : 'arraste para reordenar'})
            </Text>
          </View>

          {isWeb ? (
            // Web: ScrollView com botões ↑↓
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator>
              {currentWebList.map((item, index) => renderWebItem(item, index))}
            </ScrollView>
          ) : (
            // Mobile: DraggableFlatList
            <DraggableFlatList
              data={reorderableParadas}
              keyExtractor={(item) => item.id}
              renderItem={renderDraggableItem}
              onDragEnd={handleDragEnd}
              containerStyle={styles.listContainer}
            />
          )}
        </View>
      )}

      {/* Botões de ação para web */}
      {isWeb && hasWebChanges && (
        <View style={styles.webActionButtons}>
          <TouchableOpacity
            style={styles.webCancelButton}
            onPress={handleCancelWebChanges}
            disabled={isLoading}
          >
            <Text style={styles.webCancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.webSaveButton, isLoading && styles.webSaveButtonDisabled]}
            onPress={handleSaveWebChanges}
            disabled={isLoading}
          >
            <Ionicons name="checkmark" size={18} color={theme.colors.white} />
            <Text style={styles.webSaveButtonText}>Salvar Nova Ordem</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dica */}
      <View style={styles.tip}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
        <Text style={styles.tipText}>
          A rota será recalculada automaticamente após a reordenação.
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingOverlay: {
    ...Platform.select({
      web: {
        position: 'absolute' as const,
      },
      default: {
        position: 'absolute',
      },
    }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginTop: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs / 2,
  },
  fixedSection: {
    padding: theme.spacing.md,
  },
  draggableSection: {
    flex: 1,
    padding: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sectionLabelText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600' as const,
    color: theme.colors.gray500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  listContainer: {
    flex: 1,
  },
  fixedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    opacity: 0.7,
  },
  draggableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  draggableItemActive: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    backgroundColor: theme.colors.primaryBg || `${theme.colors.primary}10`,
  },
  dragHandle: {
    padding: theme.spacing.xs,
  },
  orderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  itemContent: {
    flex: 1,
    gap: 2,
  },
  itemAddress: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray600,
    maxWidth: 150,
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeTagEntrega: {
    backgroundColor: theme.colors.infoBg,
  },
  typeTagRetirada: {
    backgroundColor: theme.colors.warningBg,
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  typeTagTextEntrega: {
    color: theme.colors.info,
  },
  typeTagTextRetirada: {
    color: theme.colors.warning,
  },
  lockIcon: {
    padding: theme.spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.infoBg,
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  tipText: {
    flex: 1,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.info,
  },
  // Estilos específicos para web
  webMoveButtons: {
    flexDirection: 'column',
    gap: 2,
  },
  moveButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: theme.colors.gray100,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    }),
  },
  moveButtonDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  webActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  webCancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  webCancelButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  webSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.secondary,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
    }),
  },
  webSaveButtonDisabled: {
    backgroundColor: theme.colors.gray300,
    opacity: 0.6,
  },
  webSaveButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.white,
  },
}));
