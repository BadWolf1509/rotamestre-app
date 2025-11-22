import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform } from 'react-native';
import DateTimePickerModal, { useDefaultStyles } from 'react-native-ui-datepicker';

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
  const calendarStyles = {
    ...defaultStyles,
    headerText: {
      color: '#0f172a',
      fontWeight: '600',
    },
    monthText: {
      color: '#0f172a',
      fontWeight: '700',
    },
    weekDaysText: {
      color: '#1f2937',
      fontWeight: '600',
    },
    dayText: {
      color: '#0f172a',
      fontWeight: '500',
    },
    dayNumber: {
      color: '#0f172a',
    },
    daySelectedText: {
      color: '#0f172a',
      fontWeight: '700',
    },
    button_prev: {
      padding: 8,
      borderRadius: 8,
    },
    button_next: {
      padding: 8,
      borderRadius: 8,
    },
    button_prev_image: {
      tintColor: '#0f172a',
    },
    button_next_image: {
      tintColor: '#0f172a',
    },
    range_fill: {
      backgroundColor: '#eff6ff', // Azul claro para o fundo do intervalo
    },
    range_start: {
      backgroundColor: '#3b82f6', // Azul primário para o início
    },
    range_end: {
      backgroundColor: '#3b82f6', // Azul primário para o fim
    },
    range_middle: {
      backgroundColor: '#dbeafe', // Azul médio para os dias intermediários
    },
    selected: {
      backgroundColor: '#3b82f6', // Fallback para dia selecionado
    },
  };

  const datePickerComponents = {
    IconPrev: <Ionicons name="chevron-back" size={18} color="#0f172a" />,
    IconNext: <Ionicons name="chevron-forward" size={18} color="#0f172a" />,
  };

  // Estado temporário para seleção de range na Web
  const [rangeSelection, setRangeSelection] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    startDate: undefined,
    endDate: undefined,
  });

  const statusOptions = [
    { value: null, label: 'Todos', color: undefined },
    { value: 'pendente', label: 'Pendente', color: '#f59e0b' },
    { value: 'em_andamento', label: 'Em Andamento', color: '#3b82f6' },
    { value: 'concluida', label: 'Concluída', color: '#22c55e' },
    { value: 'cancelada', label: 'Cancelada', color: '#ef4444' },
  ] as const;

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
              ]}
              onPress={() => handleStatusChange(option.value)}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  filters.status === option.value && styles.statusOptionTextActive,
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
                <Ionicons name="calendar-outline" size={20} color="#64748b" />
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
                <Ionicons name="calendar-outline" size={20} color="#64748b" />
                <Text style={styles.dateButtonText}>{formatDate(filters.dataInicio)}</Text>
              </Pressable>

              <Text style={styles.dateSeparator}>até</Text>

              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDateFimPicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#64748b" />
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
                    <Ionicons name="close" size={24} color="#64748b" />
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
          <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.clearFiltersButtonText}>Limpar Filtros ({activeFiltersCount})</Text>
        </Pressable>
      )}
    </ScrollView>
  );

  if (variant === 'desktop') {
    return (
      <View style={styles.desktopContainer}>
        <View style={styles.desktopHeader}>
          <Ionicons name="filter-outline" size={20} color="#64748b" />
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
        <Ionicons name="filter-outline" size={24} color="#FFFFFF" />
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
              <Ionicons name="close" size={28} color="#64748b" />
            </Pressable>
          </View>
          <FilterContent />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  desktopContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  desktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  desktopTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mobileFilterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 24,
    right: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
  },
  filterContainer: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#FFFFFF',
  },
  statusOptionActive: {
    backgroundColor: '#3b82f615',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  statusOptionText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  statusOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#FFFFFF',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#334155',
  },
  dateInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#FFFFFF',
  },
  calendarIcon: {
    flexShrink: 0,
  },
  dateTextInput: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    padding: 0,
  },
  dateSeparator: {
    fontSize: 13,
    color: '#64748b',
  },
  motoristaList: {
    gap: 8,
  },
  motoristaOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#FFFFFF',
  },
  motoristaOptionActive: {
    backgroundColor: '#3b82f615',
    borderColor: '#3b82f6',
    borderWidth: 2,
  },
  motoristaOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  motoristaOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
    marginTop: 8,
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 320,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  dateInputSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateInputLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  dateManualInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#334155',
    backgroundColor: '#FFFFFF',
  },
  calendarNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    textTransform: 'capitalize',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  applyButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Estilos para botões de períodos pré-definidos
  presetButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#FFFFFF',
    minWidth: 90,
    alignItems: 'center',
  },
  presetButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  presetButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Resumo do período selecionado
  rangeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 16,
  },
  rangeSummaryText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '500',
  },
  // Footer reorganizado
  footerRightButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  clearPeriodButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  clearPeriodButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
});
