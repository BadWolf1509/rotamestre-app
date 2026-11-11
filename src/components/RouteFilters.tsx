/**
 * Route Filters Component
 *
 * Main component that orchestrates filter sections for routes.
 * Supports desktop (sidebar) and mobile (modal) variants.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';

import { SeletorPeriodo } from '@/components/periodo';
import { ROUTE_STATUS_CONFIG } from '@/constants/statusConfig';
import { ROTULO_PERIODO, textoDatasPeriodo, type Periodo } from '@/lib/periodo';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import {
  MotoristaFilterSection,
  StatusFilterSection,
  countActiveFilters,
  type RouteFiltersProps,
  type RouteFiltersState,
} from './route-filters';

import type { Motorista } from './route-filters/types';

export type { RouteFiltersState };

/**
 * Resumo dos filtros ativos para a barra recolhida do desktop: status,
 * período e motorista, nessa ordem ("Todos os status, este mês, todos os
 * motoristas").
 */
function resumoDosFiltros(
  filters: RouteFiltersState,
  periodo: Periodo | undefined,
  motoristas: Motorista[],
): string {
  const status = filters.status
    ? ROUTE_STATUS_CONFIG[filters.status].label
    : 'Todos os status';
  return [
    status,
    periodo ? periodoNoResumo(periodo) : null,
    motoristaNaFrase(filters, motoristas),
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Período no meio da frase do resumo: o rótulo do atalho em minúscula, sem as
 * datas (o seletor, aberto, as mostra), e as datas no personalizado.
 */
function periodoNoResumo(periodo: Periodo): string {
  const rotulo = ROTULO_PERIODO[periodo.tipo].toLowerCase();
  if (periodo.tipo !== 'personalizado') return rotulo;
  // Intervalo incompleto (só por chamada errada) devolve '': cai no rótulo,
  // nunca "Todos os status, , todos os motoristas".
  return textoDatasPeriodo(periodo) || rotulo;
}

function motoristaNaFrase(
  filters: RouteFiltersState,
  motoristas: Motorista[],
): string {
  return filters.motoristaId
    ? (motoristas.find((m) => m.id === filters.motoristaId)?.nome ??
        'motorista escolhido')
    : 'todos os motoristas';
}

export function RouteFilters({
  filters,
  onFiltersChange,
  periodo,
  onPeriodoChange,
  motoristas = [],
  variant = 'desktop',
}: RouteFiltersProps) {
  const { theme } = useUnistyles();
  const [modalVisible, setModalVisible] = useState(false);
  // Desktop: a barra começa recolhida, só com o botão e o resumo.
  const [aberto, setAberto] = useState(false);

  const activeFiltersCount = countActiveFilters(filters);

  const handleStatusChange = (status: RouteFiltersState['status']) => {
    onFiltersChange({ ...filters, status });
  };

  const handleMotoristaChange = (motoristaId: string | null) => {
    onFiltersChange({ ...filters, motoristaId });
  };

  // O período não entra: ele não conta como filtro ativo e tem seu seletor.
  const clearFilters = () => {
    onFiltersChange({ status: null, motoristaId: null });
  };

  // Função de render, NUNCA componente declarado aqui dentro: usado como JSX (`<X />`),
  // cada re-render do pai daria um tipo novo ao React e remontaria a subárvore,
  // zerando os estados internos das seções (o seletor de período aberto, o
  // personalizado em edição) no meio da interação — sem erro no console. Ver
  // CLAUDE.md.
  const renderFilterContent = () => (
    <ScrollView style={styles.filterContainer}>
      <StatusFilterSection
        status={filters.status}
        onStatusChange={handleStatusChange}
      />

      {periodo && onPeriodoChange ? (
        <View style={styles.periodoSection}>
          <Text style={styles.periodoTitle}>Período</Text>
          <SeletorPeriodo
            valor={periodo}
            aoMudar={onPeriodoChange}
            testID="filtro-periodo"
          />
        </View>
      ) : null}

      <MotoristaFilterSection
        motoristaId={filters.motoristaId}
        motoristas={motoristas}
        onMotoristaChange={handleMotoristaChange}
      />

      {/* Clear Filters Button */}
      {activeFiltersCount > 0 && (
        <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
          <Ionicons
            name="close-circle-outline"
            size={20}
            color={theme.colors.error}
          />
          <Text style={styles.clearFiltersButtonText}>
            Limpar Filtros ({activeFiltersCount})
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );

  if (variant === 'desktop') {
    return (
      <View style={styles.desktopContainer}>
        <View style={styles.desktopHeader}>
          <Pressable
            testID="route-filters-toggle"
            style={styles.desktopToggle}
            onPress={() => setAberto((valor) => !valor)}
            accessibilityRole="button"
            accessibilityLabel="Filtros"
            accessibilityState={{ expanded: aberto }}
          >
            <Ionicons
              name="filter-outline"
              size={20}
              color={theme.colors.gray600}
            />
            <Text style={styles.desktopTitle}>Filtros</Text>
            {activeFiltersCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeFiltersCount}</Text>
              </View>
            )}
            <Ionicons
              name={aberto ? 'chevron-down' : 'chevron-forward'}
              size={16}
              color={theme.colors.gray600}
            />
          </Pressable>
          <Text
            testID="route-filters-resumo"
            style={styles.desktopResumo}
            numberOfLines={1}
          >
            {resumoDosFiltros(filters, periodo, motoristas)}
          </Text>
        </View>
        {aberto ? renderFilterContent() : null}
      </View>
    );
  }

  // Mobile: Show as modal
  return (
    <>
      <Pressable
        testID="filter-floating-button"
        style={styles.mobileFilterButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="filter-outline" size={24} color={theme.colors.white} />
        {activeFiltersCount > 0 && (
          <View testID="filter-badge" style={styles.badge}>
            <Text style={styles.badgeText}>{activeFiltersCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtros Avançados</Text>
            <Pressable onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={theme.colors.gray500} />
            </Pressable>
          </View>
          {renderFilterContent()}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  desktopContainer: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  desktopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  desktopTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  desktopResumo: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray600,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs / 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  mobileFilterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: theme.spacing['2xl'],
    right: theme.spacing['2xl'],
    ...theme.shadows.lg,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  filterContainer: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  periodoSection: {
    marginBottom: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  periodoTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.errorBg,
    backgroundColor: theme.colors.red50,
    marginTop: theme.spacing.sm,
  },
  clearFiltersButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
  },
}));
