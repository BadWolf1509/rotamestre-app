/**
 * ============================================
 * ThemeSettings - Unified Theme Configuration Component
 * ============================================
 *
 * Reusable component for theme settings (mode, density, contrast)
 * with live preview and reset functionality.
 * Works on both mobile and desktop layouts.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Switch, TouchableOpacity, View } from 'react-native';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Text } from '@/design-system';
import {
  getThemePreferences,
  setContrastPreference,
  setDensityPreference,
  setThemePreference,
  ThemeContrastPreference,
  ThemeDensityPreference,
  ThemePreference,
  ThemePreferences,
  applyThemePreferences,
} from '@/lib/themePreference';
import { StyleSheet, Theme, useUnistyles } from '@/utils/styles';

interface ThemeSettingsProps {
  /**
   * Show preview section with sample components
   */
  showPreview?: boolean;

  /**
   * Callback when any setting changes
   */
  onSettingsChange?: (settings: ThemePreferences) => void;

  /**
   * Compact layout for mobile
   */
  compact?: boolean;
}

const DEFAULT_PREFERENCES: ThemePreferences = {
  mode: 'light',
  density: 'regular',
  contrast: 'normal',
};

/**
 * ThemeSettings Component
 * Provides theme customization with live preview and reset
 */
export function ThemeSettings({
  showPreview = true,
  onSettingsChange,
  compact = false,
}: ThemeSettingsProps) {
  const { theme } = useUnistyles();
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [compactDensityEnabled, setCompactDensityEnabled] = useState(false);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      try {
        const stored = await getThemePreferences();
        if (!mounted) return;

        if (stored) {
          setDarkModeEnabled(stored.mode === 'dark');
          setCompactDensityEnabled(stored.density === 'compact');
          setHighContrastEnabled(stored.contrast === 'high');
        }
      } catch (error) {
        console.warn('Failed to load theme preferences:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  const notifyChange = useCallback(
    (mode: ThemePreference, density: ThemeDensityPreference, contrast: ThemeContrastPreference) => {
      onSettingsChange?.({ mode, density, contrast });
    },
    [onSettingsChange]
  );

  const handleDarkModeToggle = async (value: boolean) => {
    setDarkModeEnabled(value);
    try {
      await setThemePreference(value ? 'dark' : 'light');
      notifyChange(
        value ? 'dark' : 'light',
        compactDensityEnabled ? 'compact' : 'regular',
        highContrastEnabled ? 'high' : 'normal'
      );
    } catch (error) {
      console.warn('Failed to update theme preference:', error);
      Alert.alert('Erro', 'Falha ao salvar preferência de tema.');
      setDarkModeEnabled(!value); // Revert on error
    }
  };

  const handleDensityToggle = async (value: boolean) => {
    setCompactDensityEnabled(value);
    try {
      await setDensityPreference(value ? 'compact' : 'regular');
      notifyChange(
        darkModeEnabled ? 'dark' : 'light',
        value ? 'compact' : 'regular',
        highContrastEnabled ? 'high' : 'normal'
      );
    } catch (error) {
      console.warn('Failed to update density preference:', error);
      Alert.alert('Erro', 'Falha ao salvar preferência de densidade.');
      setCompactDensityEnabled(!value); // Revert on error
    }
  };

  const handleContrastToggle = async (value: boolean) => {
    setHighContrastEnabled(value);
    try {
      await setContrastPreference(value ? 'high' : 'normal');
      notifyChange(
        darkModeEnabled ? 'dark' : 'light',
        compactDensityEnabled ? 'compact' : 'regular',
        value ? 'high' : 'normal'
      );
    } catch (error) {
      console.warn('Failed to update contrast preference:', error);
      Alert.alert('Erro', 'Falha ao salvar preferência de contraste.');
      setHighContrastEnabled(!value); // Revert on error
    }
  };

  const doReset = async () => {
    try {
      // Apply default preferences
      applyThemePreferences(DEFAULT_PREFERENCES);
      await setThemePreference('light');
      await setDensityPreference('regular');
      await setContrastPreference('normal');

      // Update local state
      setDarkModeEnabled(false);
      setCompactDensityEnabled(false);
      setHighContrastEnabled(false);

      notifyChange('light', 'regular', 'normal');
    } catch (error) {
      console.warn('Failed to reset preferences:', error);
      Alert.alert('Erro', 'Falha ao restaurar configurações padrão.');
    }
  };

  const handleResetToDefaults = () => {
    // Use ConfirmDialog on web, Alert.alert on mobile
    if (Platform.OS === 'web') {
      setShowResetDialog(true);
    } else {
      Alert.alert(
        'Restaurar padrões',
        'Tem certeza que deseja restaurar as configurações de aparência para os valores padrão?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: doReset,
          },
        ]
      );
    }
  };

  const handleConfirmReset = async () => {
    setShowResetDialog(false);
    await doReset();
  };

  const handleCancelReset = () => {
    setShowResetDialog(false);
  };

  const hasChanges =
    darkModeEnabled !== (DEFAULT_PREFERENCES.mode === 'dark') ||
    compactDensityEnabled !== (DEFAULT_PREFERENCES.density === 'compact') ||
    highContrastEnabled !== (DEFAULT_PREFERENCES.contrast === 'high');

  if (loading) {
    return (
      <View style={styles(theme, compact).container}>
        <Text style={styles(theme, compact).loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles(theme, compact).container}>
      <Text style={styles(theme, compact).title}>Aparência</Text>

      {/* Theme Mode Toggle */}
      <View style={styles(theme, compact).settingRow}>
        <View style={styles(theme, compact).settingInfo}>
          <Ionicons
            name={darkModeEnabled ? 'moon' : 'sunny'}
            size={compact ? 18 : 20}
            color={theme.colors.textSecondary}
          />
          <View style={styles(theme, compact).settingText}>
            <Text style={styles(theme, compact).settingLabel}>Tema escuro</Text>
            <Text style={styles(theme, compact).settingDescription}>
              Reduz o brilho em ambientes escuros
            </Text>
          </View>
        </View>
        <Switch
          value={darkModeEnabled}
          onValueChange={handleDarkModeToggle}
          trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
          thumbColor={darkModeEnabled ? theme.colors.white : theme.colors.gray100}
        />
      </View>

      {/* Density Toggle */}
      <View style={styles(theme, compact).settingRow}>
        <View style={styles(theme, compact).settingInfo}>
          <Ionicons
            name={compactDensityEnabled ? 'contract' : 'expand'}
            size={compact ? 18 : 20}
            color={theme.colors.textSecondary}
          />
          <View style={styles(theme, compact).settingText}>
            <Text style={styles(theme, compact).settingLabel}>Modo compacto</Text>
            <Text style={styles(theme, compact).settingDescription}>
              Reduz espaçamentos para mostrar mais informação
            </Text>
          </View>
        </View>
        <Switch
          value={compactDensityEnabled}
          onValueChange={handleDensityToggle}
          trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
          thumbColor={compactDensityEnabled ? theme.colors.white : theme.colors.gray100}
        />
      </View>

      {/* High Contrast Toggle */}
      <View style={[styles(theme, compact).settingRow, styles(theme, compact).settingRowLast]}>
        <View style={styles(theme, compact).settingInfo}>
          <Ionicons
            name="contrast"
            size={compact ? 18 : 20}
            color={theme.colors.textSecondary}
          />
          <View style={styles(theme, compact).settingText}>
            <Text style={styles(theme, compact).settingLabel}>Alto contraste</Text>
            <Text style={styles(theme, compact).settingDescription}>
              Aumenta contraste para melhor legibilidade
            </Text>
          </View>
        </View>
        <Switch
          value={highContrastEnabled}
          onValueChange={handleContrastToggle}
          trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
          thumbColor={highContrastEnabled ? theme.colors.white : theme.colors.gray100}
        />
      </View>

      {/* Preview Section */}
      {showPreview && (
        <View style={styles(theme, compact).previewSection}>
          <Text style={styles(theme, compact).previewTitle}>Visualização</Text>
          <View style={styles(theme, compact).previewContainer}>
            {/* Sample Button */}
            <View style={styles(theme, compact).previewItem}>
              <View style={styles(theme, compact).sampleButton}>
                <Text style={styles(theme, compact).sampleButtonText}>Botão</Text>
              </View>
              <Text style={styles(theme, compact).previewLabel}>Botão</Text>
            </View>

            {/* Sample Card */}
            <View style={styles(theme, compact).previewItem}>
              <View style={styles(theme, compact).sampleCard}>
                <Text style={styles(theme, compact).sampleCardTitle}>Card</Text>
                <Text style={styles(theme, compact).sampleCardText}>Texto</Text>
              </View>
              <Text style={styles(theme, compact).previewLabel}>Card</Text>
            </View>

            {/* Sample Badge */}
            <View style={styles(theme, compact).previewItem}>
              <View style={styles(theme, compact).sampleBadge}>
                <Text style={styles(theme, compact).sampleBadgeText}>Status</Text>
              </View>
              <Text style={styles(theme, compact).previewLabel}>Badge</Text>
            </View>
          </View>
        </View>
      )}

      {/* Reset Button */}
      {hasChanges && (
        <TouchableOpacity
          style={styles(theme, compact).resetButton}
          onPress={handleResetToDefaults}
        >
          <Ionicons name="refresh" size={16} color={theme.colors.textSecondary} />
          <Text style={styles(theme, compact).resetButtonText}>Restaurar padrões</Text>
        </TouchableOpacity>
      )}

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        visible={showResetDialog}
        title="Restaurar padrões"
        message="Tem certeza que deseja restaurar as configurações de aparência para os valores padrão?"
        confirmText="Restaurar"
        cancelText="Cancelar"
        onConfirm={handleConfirmReset}
        onCancel={handleCancelReset}
        type="destructive"
      />
    </View>
  );
}

const styles = (theme: Theme, compact: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: compact ? theme.spacing.md : theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      padding: theme.spacing.lg,
    },
    title: {
      fontSize: compact ? theme.typography.fontSize.sm : theme.typography.fontSize.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: compact ? theme.spacing.sm : theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    settingRowLast: {
      borderBottomWidth: 0,
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: compact ? theme.spacing.sm : theme.spacing.md,
    },
    settingText: {
      flex: 1,
    },
    settingLabel: {
      fontSize: compact ? theme.typography.fontSize.sm : theme.typography.fontSize.base,
      fontFamily: theme.typography.fontSansMedium,
      color: theme.colors.text,
    },
    settingDescription: {
      fontSize: compact ? 11 : theme.typography.fontSize.xs,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    previewSection: {
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.divider,
    },
    previewTitle: {
      fontSize: theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.spacing.md,
    },
    previewContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
    },
    previewItem: {
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    previewLabel: {
      fontSize: theme.typography.fontSize.xs, // Min readable (WCAG AA)
      color: theme.colors.textTertiary,
    },
    sampleButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: compact
        ? theme.components.button.size.small.paddingHorizontal
        : theme.components.button.size.medium.paddingHorizontal,
      paddingVertical: compact
        ? theme.components.button.size.small.paddingVertical
        : theme.components.button.size.medium.paddingVertical,
      borderRadius: theme.components.button.radius,
      minHeight: compact
        ? theme.components.button.size.small.height
        : theme.components.button.size.medium.height,
      justifyContent: 'center',
    },
    sampleButtonText: {
      color: theme.colors.white,
      fontSize: compact
        ? theme.components.button.size.small.fontSize
        : theme.components.button.size.medium.fontSize,
      fontFamily: theme.typography.fontSansSemiBold,
    },
    sampleCard: {
      backgroundColor: theme.colors.card,
      padding: compact
        ? theme.components.card.padding.small
        : theme.components.card.padding.medium,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minWidth: 60,
    },
    sampleCardTitle: {
      fontSize: compact ? 11 : theme.typography.fontSize.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.text,
    },
    sampleCardText: {
      fontSize: compact ? 10 : 11,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    sampleBadge: {
      backgroundColor: theme.colors.successBg,
      paddingHorizontal: compact
        ? theme.components.badge.size.small.paddingHorizontal
        : theme.components.badge.size.medium.paddingHorizontal,
      paddingVertical: compact
        ? theme.components.badge.size.small.paddingVertical
        : theme.components.badge.size.medium.paddingVertical,
      borderRadius: theme.borderRadius.sm,
    },
    sampleBadgeText: {
      fontSize: compact
        ? theme.components.badge.size.small.fontSize
        : theme.components.badge.size.medium.fontSize,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.success,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.gray100,
    },
    resetButtonText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontSansMedium,
    },
  });

export default ThemeSettings;
