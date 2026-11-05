/**
 * CategoryStep - Step 1: Category selection for incident report
 */

import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import { INCIDENT_CATEGORIES, getIncidentColor } from './types';

interface CategoryStepProps {
  selectedCategory: string;
  onSelectCategory: (value: string) => void;
  isDesktop: boolean;
}

function CategoryStepComponent({
  selectedCategory,
  onSelectCategory,
  isDesktop,
}: CategoryStepProps) {
  const { theme } = useUnistyles();

  return (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Qual o tipo de problema?
      </Text>
      <Text style={styles.stepSubtitle}>
        Selecione a categoria que melhor descreve a situação
      </Text>

      <View style={[styles.categoriesContainer, isDesktop && styles.categoriesContainerDesktop]}>
        {INCIDENT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.value}
            style={[
              styles.categoryCard,
              isDesktop && styles.categoryCardDesktop,
              selectedCategory === category.value && styles.categoryCardSelected,
            ]}
            onPress={() => onSelectCategory(category.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedCategory === category.value }}
            accessibilityLabel={category.label}
          >
            <View style={[styles.categoryIcon, { backgroundColor: getIncidentColor(theme, category.colorKey) + '20' }]}>
              <Ionicons name={category.icon} size={24} color={getIncidentColor(theme, category.colorKey)} />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === category.value && styles.categoryLabelSelected,
              ]}
            >
              {category.label}
            </Text>
            {selectedCategory === category.value && (
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export const CategoryStep = memo(CategoryStepComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  stepContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  stepTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  stepTitleDesktop: {
    fontSize: theme.typography.lg,
  },
  stepSubtitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.lg,
  },
  categoriesContainer: {
    gap: theme.spacing.sm,
  },
  categoriesContainerDesktop: {
    gap: theme.spacing.xs,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardDesktop: {
    padding: theme.spacing.sm,
  },
  categoryCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryBg,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  categoryLabel: {
    flex: 1,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  categoryLabelSelected: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
}));
