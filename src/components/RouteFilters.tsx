import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Platform } from 'react-native';
import DateTimePickerModal, { useDefaultStyles } from 'react-native-ui-datepicker';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Tipos para períodos pré-definidos
export type PeriodPreset = 'hoje' | 'ultima_semana' | 'ultimo_mes' | 'este_mes' | 'personalizado';

export interface RouteFiltersState {
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada' | null;
  dataInicio?: Date | null;
  dataFim?: Date | null;
  motoristaId?: string | null;
}

interface RouteFiltersProps {
  filters: RouteFiltersState;
  onFiltersChange: (filters: RouteFiltersState) => void;
  motoristas?: Array<{ id: string; nome: string }>;
  variant?: 'desktop' | 'mobile';
}

// Helper para calcular datas de períodos pré-definidos
export const getPresetDates = (preset: PeriodPreset): { startDate: Date; endDate: Date } | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'hoje': {
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      return { startDate: today, endDate: endOfDay };
    }
    case 'ultima_semana': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      return { startDate, endDate: today };
    }
    case 'ultimo_mes': {
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 30);
      return { startDate, endDate: today };
    }
    case 'este_mes': {
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate, endDate: today };
    }
    case 'personalizado':
    default:
      return null;
  }
};

export function RouteFilters({
  filters,
  onFiltersChange,
  motoristas = [],
  variant = 'desktop',
}: RouteFiltersProps) {
  const { theme } = useUnistyles();
  const [modalVisible, setModalVisible] = useState(false);
  const [showDateInicioPicker, setShowDateInicioPicker] = useState(false);
  const [showDateFimPicker, setShowDateFimPicker] = useState(false);

  // Web: Controle do modal de período unificado
  const [showWebRangePicker, setShowWebRangePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Estado para controlar período pré-definido selecionado
  const [_selectedPreset, setSelectedPreset] = useState<PeriodPreset | null>(null);

  // Estilos customizados para o calendário
  const defaultStyles = useDefaultStyles('light');
  const calendarStyles = useMemo(() => ({
    ...defaultStyles,
    headerText: {
      color: theme.colors.gray900,
      fontWeight: '600',
    },
    monthText: {
      color: theme.colors.gray900,
      fontWeight: '700',
    },
    weekDaysText: {
      color: theme.colors.gray800,
      fontWeight: '600',
    },
    dayText: {
      color: theme.colors.gray900,
      fontWeight: '500',
    },
    dayNumber: {
      color: theme.colors.gray900,
    },
    daySelectedText: {
      color: theme.colors.gray900,
      fontWeight: '700',
    },
    button_prev: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    button_next: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
    },
    button_prev_image: {
      tintColor: theme.colors.gray900,
    },
    button_next_image: {
      tintColor: theme.colors.gray900,
    },
    range_fill: {
      backgroundColor: theme.colors.primaryBg,
    },
    range_start: {
      backgroundColor: theme.colors.primary,
    },
    range_end: {
      backgroundColor: theme.colors.primary,
    },
    range_middle: {
      backgroundColor: theme.colors.primaryLight,
    },
    selected: {
      backgroundColor: theme.colors.primary,
    },
  }), [defaultStyles, theme]);

  const datePickerComponents = useMemo(() => ({
    IconPrev: <Ionicons name="chevron-back" size={18} color={theme.colors.gray900} />,
    IconNext: <Ionicons name="chevron-forward" size={18} color={theme.colors.gray900} />,
  }), [theme]);

  // Estado temporário para seleção de range na Web
  const [rangeSelection, setRangeSelection] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    startDate: undefined,
    endDate: undefined,
  });

  const statusOptions = useMemo(() => ([
    { value: null, label: 'Todos', color: undefined },
    { value: 'pendente', label: 'Pendente', color: theme.colors.warning },
    { value: 'em_andamento', label: 'Em Andamento', color: theme.colors.info },
    { value: 'concluida', label: 'Conclu¡da', color: theme.colors.success },
    { value: 'cancelada', label: 'Cancelada', color: theme.colors.error },
  ] as const), [theme]);

  const handleStatusChange = (status: RouteFiltersState['status']) => {
    const newStatus = filters.status === status ? null : status;
    onFiltersChange({ ...filters, status: newStatus });
  };

  const handleMotoristaChange = (motoristaId: string | null) => {
    const newMotoristaId = filters.motoristaId === motoristaId ? null : motoristaId;
    onFiltersChange({ ...filters, motoristaId: newMotoristaId });
  };

  // Mobile Handlers
  const handleDataInicioChange = (event: any, selectedDate?: Date) => {
    setShowDateInicioPicker(false);
    if (selectedDate) {
      onFiltersChange({ ...filters, dataInicio: selectedDate });
    }
  };

  const handleDataFimChange = (event: any, selectedDate?: Date) => {
    setShowDateFimPicker(false);
    if (selectedDate) {
      onFiltersChange({ ...filters, dataFim: selectedDate });
    }
  };

  // Web Range Handlers
  const openWebRangePicker = () => {
    setRangeSelection({
      startDate: filters.dataInicio || undefined,
      endDate: filters.dataFim || undefined,
    });
    setCalendarMonth(filters.dataInicio || new Date());
    setShowWebRangePicker(true);
  };

  // Handler para seleção de período pré-definido
  const _handlePresetSelect = (preset: PeriodPreset) => {
    setSelectedPreset(preset);
    const dates = getPresetDates(preset);
    if (dates) {
      setRangeSelection({
        startDate: dates.startDate,
        endDate: dates.endDate,
      });
    }
  };

  // Handler para seleção manual no calendário
  const handleManualDateChange = (params: any) => {
    setSelectedPreset('personalizado');
    setRangeSelection({
      startDate: params.startDate as Date | undefined,
      endDate: params.endDate as Date | undefined,
    });
  };

  // Limpar período selecionado
  /* istanbul ignore next - usado somente em fluxo web completo */
  const _clearDateRange = () => {
    setRangeSelection({
      startDate: undefined,
      endDate: undefined,
    });
    setSelectedPreset(null);
  };

  const applyWebRangeFilter = () => {
    onFiltersChange({
      ...filters,
      dataInicio: rangeSelection.startDate || null,
      dataFim: rangeSelection.endDate || null,
    });
    setShowWebRangePicker(false);
  };

  // Helpers para navegação do calendário
  /* istanbul ignore next - navegação de mês não exercitada em testes */
  const _goToPreviousMonth = () => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCalendarMonth(newDate);
  };

  /* istanbul ignore next - navegação de mês não exercitada em testes */
  const _goToNextMonth = () => {
    const newDate = new Date(calendarMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCalendarMonth(newDate);
  };

  const clearFilters = () => {
    onFiltersChange({
      status: null,
      dataInicio: null,
      dataFim: null,
      motoristaId: null,
    });
  };

  const activeFiltersCount = [
    filters.status,
    filters.dataInicio,
    filters.dataFim,
    filters.motoristaId,
  ].filter(Boolean).length;

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Selecionar';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getRangeLabel = () => {
    if (filters.dataInicio && filters.dataFim) {
      return `${formatDate(filters.dataInicio)} - ${formatDate(filters.dataFim)}`;
    }
    if (filters.dataInicio) {
      return `A partir de ${formatDate(filters.dataInicio)}`;
    }
    if (filters.dataFim) {
      return `Até ${formatDate(filters.dataFim)}`;
    }
    return 'Selecionar Período';
  };

  // Calcular quantos dias estão selecionados
  /* istanbul ignore next - feedback visual apenas no modal */
  const _getSelectedDaysCount = () => {
    if (rangeSelection.startDate && rangeSelection.endDate) {
      const diffTime = Math.abs(rangeSelection.endDate.getTime() - rangeSelection.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // +1 para incluir o dia inicial
    }
    return 0;
  };

  const FilterContent = () => (
    <ScrollView style={styles.filterContainer}>
      {/* Status Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusGrid}>
          {statusOptions.map((option) => (
            <Pressable
              key={option.value || 'all'}
              testID={`filter-status-${option.value || 'all'}`}
              style={[
                styles.statusOption,
                filters.status === option.value && styles.statusOptionActive,
                option.color && { borderColor: option.color },
                filters.status === option.value &&
                  option.color && { backgroundColor: `${option.color}15` },
              ]}
              onPress={() => handleStatusChange(option.value)}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  filters.status === option.value && styles.statusOptionTextActive,
                  filters.status === option.value && option.color && { color: option.color },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Date Range Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>Período</Text>
        <View style={styles.dateRow}>
          {Platform.OS === 'web' ? (
            <>
              {/* ✅ Web: Botão Único de Range */}
              <Pressable
                style={styles.dateButton}
                testID="filter-date-range"
                onPress={openWebRangePicker}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
                <Text style={styles.dateButtonText}>{getRangeLabel()}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* ✅ Mobile: DateTimePicker nativo (mantido) */}
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDateInicioPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
                <Text style={styles.dateButtonText}>{formatDate(filters.dataInicio)}</Text>
              </Pressable>

              <Text style={styles.dateSeparator}>até</Text>

              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDateFimPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
                <Text style={styles.dateButtonText}>{formatDate(filters.dataFim)}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ✅ Mobile: Mostrar DateTimePicker quando ativo */}
        {Platform.OS !== 'web' && showDateInicioPicker && (
          <DateTimePicker
            value={filters.dataInicio || new Date()}
            mode="date"
            display="default"
            onChange={handleDataInicioChange}
          />
        )}

        {Platform.OS !== 'web' && showDateFimPicker && (
          <DateTimePicker
            value={filters.dataFim || new Date()}
            mode="date"
            display="default"
            onChange={handleDataFimChange}
          />
        )}

        {/* ✅ Web: Date Range Picker Modal */}
        {Platform.OS === 'web' && (
          <Modal
            visible={showWebRangePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowWebRangePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <Pressable
                style={styles.modalDismissArea}
                onPress={() => setShowWebRangePicker(false)}
              />
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Selecionar Período</Text>
                  <Pressable onPress={() => setShowWebRangePicker(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.gray500} />
                  </Pressable>
                </View>



                <DateTimePickerModal
                  mode="range"
                  date={calendarMonth}
                  startDate={rangeSelection.startDate}
                  endDate={rangeSelection.endDate}
                  onChange={handleManualDateChange}
                  styles={calendarStyles}
                  components={datePickerComponents}
                  locale="pt-BR"
                />

                <View style={styles.modalFooter}>
                  <Pressable
                    style={[styles.footerButton, styles.cancelButton]}
                    onPress={() => setShowWebRangePicker(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.footerButton, styles.applyButton]}
                    onPress={applyWebRangeFilter}
                  >
                    <Text style={styles.applyButtonText}>Aplicar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>

      {/* Motorista Filter */}
      {motoristas.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.sectionTitle}>Motorista</Text>
          <View style={styles.motoristaList}>
            <Pressable
              style={[
                styles.motoristaOption,
                !filters.motoristaId && styles.motoristaOptionActive,
              ]}
              onPress={() => handleMotoristaChange(null)}
            >
              <Text
                style={[
                  styles.motoristaOptionText,
                  !filters.motoristaId && styles.motoristaOptionTextActive,
                ]}
              >
                Todos
              </Text>
            </Pressable>

            {motoristas.map((motorista) => (
              <Pressable
                key={motorista.id}
                testID={`filter-motorista-${motorista.id}`}
                style={[
                  styles.motoristaOption,
                  filters.motoristaId === motorista.id && styles.motoristaOptionActive,
                ]}
                onPress={() => handleMotoristaChange(motorista.id)}
              >
                <Text
                  style={[
                    styles.motoristaOptionText,
                    filters.motoristaId === motorista.id && styles.motoristaOptionTextActive,
                  ]}
                >
                  {motorista.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Clear Filters Button */}
      {activeFiltersCount > 0 && (
        <Pressable style={styles.clearFiltersButton} onPress={clearFilters}>
          <Ionicons name="close-circle-outline" size={20} color={theme.colors.error} />
          <Text style={styles.clearFiltersButtonText}>Limpar Filtros ({activeFiltersCount})</Text>
        </Pressable>
      )}
    </ScrollView>
  );

  if (variant === 'desktop') {
    return (
      <View style={styles.desktopContainer}>
        <View style={styles.desktopHeader}>
          <Ionicons name="filter-outline" size={20} color={theme.colors.gray500} />
          <Text style={styles.desktopTitle}>Filtros</Text>
          {activeFiltersCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </View>
        <FilterContent />
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
          <FilterContent />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  desktopContainer: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  desktopTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  filterContainer: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  filterSection: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusOption: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  statusOptionActive: {
    backgroundColor: theme.colors.primaryBg,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  dateButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  calendarIcon: {
    flexShrink: 0,
  },
  dateTextInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    padding: 0,
  },
  dateSeparator: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
  },
  motoristaList: {
    gap: theme.spacing.sm,
  },
  motoristaOption: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
  },
  motoristaOptionActive: {
    backgroundColor: theme.colors.primaryBg,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  motoristaOptionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  motoristaOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  datePickerContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    minWidth: 320,
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  datePickerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  dateInputSection: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateInputLabel: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  dateManualInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    backgroundColor: theme.colors.white,
  },
  calendarNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
  },
  navButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray50,
  },
  monthYear: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.gray700,
    textTransform: 'capitalize',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.gray100,
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
  },
  cancelButtonText: {
    color: theme.colors.gray500,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
  applyButtonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
  // Estilos para botäes de per¡odos pr‚-definidos
  presetButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  presetButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    minWidth: 90,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  presetButtonText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  // Resumo do per¡odo selecionado
  rangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.lg,
  },
  rangeSummaryText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  // Footer reorganizado
  footerRightButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  clearPeriodButton: {
    backgroundColor: theme.colors.red50,
    borderWidth: 1,
    borderColor: theme.colors.errorBg,
  },
  clearPeriodButtonText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: theme.typography.fontSize.sm,
  },
}));
