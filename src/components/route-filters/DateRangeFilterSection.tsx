/**
 * Date Range Filter Section
 *
 * Filter by date range with platform-specific date pickers.
 * - Web: Custom calendar modal with range selection
 * - Mobile: Native DateTimePicker
 */

import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import DateTimePickerModal, { useDefaultStyles } from 'react-native-ui-datepicker';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { formatDate, getRangeLabel, getPresetDates } from './utils';

import type { PeriodPreset } from './types';

interface DateRangeFilterSectionProps {
  dataInicio: Date | null | undefined;
  dataFim: Date | null | undefined;
  onDateRangeChange: (dataInicio: Date | null, dataFim: Date | null) => void;
}

export function DateRangeFilterSection({
  dataInicio,
  dataFim,
  onDateRangeChange,
}: DateRangeFilterSectionProps) {
  const { theme } = useUnistyles();

  // Mobile: Individual date pickers
  const [showDateInicioPicker, setShowDateInicioPicker] = useState(false);
  const [showDateFimPicker, setShowDateFimPicker] = useState(false);

  // Web: Range picker modal
  const [showWebRangePicker, setShowWebRangePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [_selectedPreset, setSelectedPreset] = useState<PeriodPreset | null>(null);
  const [rangeSelection, setRangeSelection] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
  }>({
    startDate: undefined,
    endDate: undefined,
  });

  // Calendar styles for web
  const defaultStyles = useDefaultStyles('light');
  const calendarStyles = useMemo(() => ({
    ...defaultStyles,
    headerText: {
      color: theme.colors.gray900,
      fontWeight: '600' as const,
    },
    monthText: {
      color: theme.colors.gray900,
      fontWeight: '700' as const,
    },
    weekDaysText: {
      color: theme.colors.gray800,
      fontWeight: '600' as const,
    },
    dayText: {
      color: theme.colors.gray900,
      fontWeight: '500' as const,
    },
    dayNumber: {
      color: theme.colors.gray900,
    },
    daySelectedText: {
      color: theme.colors.gray900,
      fontWeight: '700' as const,
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

  // Mobile handlers
  const handleDataInicioChange = (_event: any, selectedDate?: Date) => {
    setShowDateInicioPicker(false);
    if (selectedDate) {
      onDateRangeChange(selectedDate, dataFim || null);
    }
  };

  const handleDataFimChange = (_event: any, selectedDate?: Date) => {
    setShowDateFimPicker(false);
    if (selectedDate) {
      onDateRangeChange(dataInicio || null, selectedDate);
    }
  };

  // Web handlers
  const openWebRangePicker = () => {
    setRangeSelection({
      startDate: dataInicio || undefined,
      endDate: dataFim || undefined,
    });
    setCalendarMonth(dataInicio || new Date());
    setShowWebRangePicker(true);
  };

  const handleManualDateChange = (params: any) => {
    setSelectedPreset('personalizado');
    setRangeSelection({
      startDate: params.startDate as Date | undefined,
      endDate: params.endDate as Date | undefined,
    });
  };

  const applyWebRangeFilter = () => {
    onDateRangeChange(
      rangeSelection.startDate || null,
      rangeSelection.endDate || null
    );
    setShowWebRangePicker(false);
  };

  // Unused but kept for future use
  /* istanbul ignore next */
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

  return (
    <View style={styles.filterSection}>
      <Text style={styles.sectionTitle}>Período</Text>
      <View style={styles.dateRow}>
        {Platform.OS === 'web' ? (
          <Pressable
            style={styles.dateButton}
            testID="filter-date-range"
            onPress={openWebRangePicker}
          >
            <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
            <Text style={styles.dateButtonText}>{getRangeLabel(dataInicio, dataFim)}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={styles.dateButton}
              onPress={() => setShowDateInicioPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
              <Text style={styles.dateButtonText}>{formatDate(dataInicio)}</Text>
            </Pressable>

            <Text style={styles.dateSeparator}>até</Text>

            <Pressable
              style={styles.dateButton}
              onPress={() => setShowDateFimPicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.gray500} />
              <Text style={styles.dateButtonText}>{formatDate(dataFim)}</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Mobile: Native DateTimePicker */}
      {Platform.OS !== 'web' && showDateInicioPicker && (
        <DateTimePicker
          value={dataInicio || new Date()}
          mode="date"
          display="default"
          onChange={handleDataInicioChange}
        />
      )}

      {Platform.OS !== 'web' && showDateFimPicker && (
        <DateTimePicker
          value={dataFim || new Date()}
          mode="date"
          display="default"
          onChange={handleDataFimChange}
        />
      )}

      {/* Web: Date Range Picker Modal */}
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
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  filterSection: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.md,
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
  dateSeparator: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
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
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
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
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
  applyButtonText: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
  },
}));
