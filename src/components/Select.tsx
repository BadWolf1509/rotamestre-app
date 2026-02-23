/**
 * Select - Dropdown selection component
 *
 * Cross-platform dropdown with search support.
 * Uses a Modal/bottom-sheet pattern for mobile and dropdown for web.
 *
 * @example Basic
 * ```tsx
 * <Select
 *   label="Motorista"
 *   value={motoristaId}
 *   onChange={setMotoristaId}
 *   options={motoristas.map(m => ({ value: m.id, label: m.nome }))}
 *   placeholder="Selecione um motorista"
 * />
 * ```
 *
 * @example With search
 * ```tsx
 * <Select
 *   label="Cidade"
 *   value={cidade}
 *   onChange={setCidade}
 *   options={cidades}
 *   searchable
 *   placeholder="Buscar cidade..."
 * />
 * ```
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import {
  Pressable,
  Text,
  View,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ViewStyle,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';

import type { PressableStateWithHover } from '@/types';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type SelectSize = 'small' | 'medium' | 'large';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  /** Currently selected value */
  value: T | null;
  /** Callback fired when selection changes */
  onChange: (value: T) => void;
  /** Available options */
  options: SelectOption<T>[];
  /** Label text */
  label?: string;
  /** Placeholder when no value is selected */
  placeholder?: string;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Enable search/filter in options */
  searchable?: boolean;
  /** Size variant */
  size?: SelectSize;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Whether field is required */
  required?: boolean;
  /** Container style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

const SIZE_MAP: Record<SelectSize, { height: number; fontSize: number; iconSize: number }> = {
  small: { height: 36, fontSize: 13, iconSize: 16 },
  medium: { height: 44, fontSize: 14, iconSize: 20 },
  large: { height: 52, fontSize: 16, iconSize: 22 },
};

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Selecione...',
  disabled = false,
  searchable = false,
  size = 'medium',
  error,
  helperText,
  required = false,
  style,
  testID,
}: SelectProps<T>) {
  const { theme } = useUnistyles();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sizeTokens = SIZE_MAP[size];

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setOpen(false);
    setSearch('');
  };

  const renderOption = ({ item }: { item: SelectOption<T> }) => {
    const isSelected = item.value === value;
    return (
      <TouchableOpacity
        style={[
          styles.option,
          isSelected && styles.optionSelected,
          item.disabled && styles.optionDisabled,
        ]}
        onPress={() => !item.disabled && handleSelect(item.value)}
        disabled={item.disabled}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.optionText,
            isSelected && styles.optionTextSelected,
            item.disabled && styles.optionTextDisabled,
          ]}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={style}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      {/* Trigger */}
      <Pressable
        testID={testID}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        style={(state) => {
          const { hovered } = state as PressableStateWithHover;
          return [
            styles.trigger,
            { height: sizeTokens.height },
            disabled && styles.triggerDisabled,
            !!error && styles.triggerError,
            hovered && !disabled && styles.triggerHovered,
          ];
        }}
      >
        <Text
          style={[
            styles.triggerText,
            { fontSize: sizeTokens.fontSize },
            !selectedOption && styles.triggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={sizeTokens.iconSize}
          color={disabled ? theme.colors.gray300 : theme.colors.gray500}
        />
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}
      {helperText && !error && <Text style={styles.helper}>{helperText}</Text>}

      {/* Dropdown Modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => { setOpen(false); setSearch(''); }}
        statusBarTranslucent
      >
        <Pressable
          style={styles.overlay}
          onPress={() => { setOpen(false); setSearch(''); }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.dropdownWrapper}
          >
            <Pressable style={styles.dropdown} onPress={(e) => e.stopPropagation?.()}>
              {/* Header */}
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>{label ?? 'Selecione'}</Text>
                <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }}>
                  <Ionicons name="close" size={24} color={theme.colors.gray600} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              {searchable && (
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={theme.colors.gray400} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar..."
                    placeholderTextColor={theme.colors.gray400}
                    autoFocus
                  />
                </View>
              )}

              {/* Options List */}
              <FlatList
                data={filteredOptions}
                keyExtractor={(item) => item.value}
                renderItem={renderOption}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Nenhuma opção encontrada</Text>
                }
              />
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  label: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    marginBottom: theme.spacing['1.5'],
  },
  required: {
    color: theme.colors.error,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing['3'],
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  triggerDisabled: {
    backgroundColor: theme.colors.gray100,
    borderColor: theme.colors.gray200,
  },
  triggerError: {
    borderColor: theme.colors.error,
  },
  triggerHovered: {
    borderColor: theme.colors.gray400,
  },
  triggerText: {
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    flex: 1,
    marginRight: theme.spacing['2'],
  },
  triggerPlaceholder: {
    color: theme.colors.gray400,
  },
  error: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    marginTop: theme.spacing['1'],
  },
  helper: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing['1'],
  },
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  dropdownWrapper: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  dropdown: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  dropdownTitle: {
    fontFamily: theme.typography.fontSansBold,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray900,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: theme.spacing['3'],
    paddingHorizontal: theme.spacing['3'],
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray50,
    gap: theme.spacing['2'],
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    padding: 0,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
  },
  list: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing['4'],
    paddingVertical: theme.spacing['3'],
  },
  optionSelected: {
    backgroundColor: theme.colors.primaryLight
      ? `${theme.colors.primary}10`
      : theme.colors.gray50,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray800,
    flex: 1,
  },
  optionTextSelected: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  optionTextDisabled: {
    color: theme.colors.gray400,
  },
  emptyText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    textAlign: 'center',
    padding: theme.spacing.xl,
  },
}));

export default Select;
