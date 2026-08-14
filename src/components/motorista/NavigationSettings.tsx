import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Slider from '@/components/Slider';
import { useAlert } from '@/hooks/useAlert';
import LocationTrackingService from '@/services/locationTracking';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

type NavAppPreference = 'waze' | 'google_maps' | 'apple_maps' | 'default';

interface NavigationSettingsProps {
  /** Se true, renderiza como modal. Se false/omitido no modo inline, será ignorado. */
  visible?: boolean;
  /** Callback para fechar o modal. Requerido apenas para variant='modal'. */
  onClose?: () => void;
  /** Define se o componente renderiza como modal ou inline. Default: 'modal'. */
  variant?: 'modal' | 'inline';
  /** Callback chamado quando alguma configuração é alterada. */
  onSettingsChange?: (settings: NavigationSettingsState) => void;
}

export interface NavigationSettingsState {
  autoAdvance: boolean;
  soundAlerts: boolean;
  vibrationAlerts: boolean;
  proximityRadius: number;
  showSpeedometer: boolean;
  preventScreenSleep: boolean;
  voiceNavigation: boolean;
  internalNavigation: boolean;
  preferredNavApp: NavAppPreference;
}

type SettingKey = keyof NavigationSettingsState;
type SettingValue<K extends SettingKey> = NavigationSettingsState[K];

const DEFAULT_SETTINGS: NavigationSettingsState = {
  autoAdvance: true,
  soundAlerts: true,
  vibrationAlerts: true,
  proximityRadius: 50,
  showSpeedometer: true,
  preventScreenSleep: true,
  voiceNavigation: false,
  internalNavigation: false,
  preferredNavApp: 'default',
};

const NAV_APP_OPTIONS: {
  value: NavAppPreference;
  label: string;
  icon: string;
  platform?: string;
}[] = [
  { value: 'default', label: 'Padrão do Sistema', icon: '📱' },
  { value: 'waze', label: 'Waze', icon: '🗺️' },
  { value: 'google_maps', label: 'Google Maps', icon: '🌍' },
  { value: 'apple_maps', label: 'Apple Maps', icon: '🍎', platform: 'ios' },
];

export function NavigationSettings({
  visible = false,
  onClose,
  variant = 'modal',
  onSettingsChange,
}: NavigationSettingsProps) {
  const { theme } = useUnistyles();
  const { showSuccess, showConfirm, AlertDialog } = useAlert();
  const isWeb = Platform.OS === 'web';

  const [settings, setSettings] =
    useState<NavigationSettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const prefs = await LocationTrackingService.getNavigationPreferences();
    const newSettings = {
      ...DEFAULT_SETTINGS,
      autoAdvance: prefs.autoAdvance ?? DEFAULT_SETTINGS.autoAdvance,
      soundAlerts: prefs.soundAlerts ?? DEFAULT_SETTINGS.soundAlerts,
      vibrationAlerts:
        prefs.vibrationAlerts ?? DEFAULT_SETTINGS.vibrationAlerts,
      proximityRadius:
        prefs.proximityRadius ?? DEFAULT_SETTINGS.proximityRadius,
      showSpeedometer:
        prefs.showSpeedometer ?? DEFAULT_SETTINGS.showSpeedometer,
      preventScreenSleep:
        prefs.preventScreenSleep ?? DEFAULT_SETTINGS.preventScreenSleep,
      voiceNavigation:
        prefs.voiceNavigation ?? DEFAULT_SETTINGS.voiceNavigation,
      internalNavigation:
        prefs.internalNavigation ?? DEFAULT_SETTINGS.internalNavigation,
      preferredNavApp:
        (prefs.preferredNavApp as NavAppPreference) ??
        DEFAULT_SETTINGS.preferredNavApp,
    };
    setSettings(newSettings);
  };

  const triggerHapticFeedback = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Haptics not available
      }
    }
  };

  const handleSettingChange = async <K extends SettingKey>(
    key: K,
    value: SettingValue<K>,
  ) => {
    // Validate proximity radius
    if (key === 'proximityRadius') {
      const numValue = value as number;
      if (numValue < 20 || numValue > 100) return;
    }

    await triggerHapticFeedback();

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to preferences
    await LocationTrackingService.updateNavigationPreferences({
      [key]: value,
    });

    // Notify parent if callback provided
    onSettingsChange?.(newSettings);
  };

  const handleResetDefaults = async () => {
    const confirmed = await showConfirm({
      title: 'Restaurar Padrões',
      message:
        'Deseja restaurar todas as configurações para os valores padrão?',
      confirmText: 'Restaurar',
      cancelText: 'Cancelar',
      type: 'danger',
    });

    if (confirmed) {
      await triggerHapticFeedback();
      setSettings(DEFAULT_SETTINGS);
      await LocationTrackingService.updateNavigationPreferences(
        DEFAULT_SETTINGS,
      );
      onSettingsChange?.(DEFAULT_SETTINGS);
      showSuccess('Sucesso', 'Configurações restauradas');
    }
  };

  // Filter nav options based on platform
  const navOptions = NAV_APP_OPTIONS.filter(
    (opt) => !opt.platform || opt.platform === Platform.OS,
  );

  // Settings content - reused in both modal and inline variants.
  // Função de render, NUNCA componente declarado aqui dentro: usado como JSX
  // (`<X />`), cada mudança de configuração daria um tipo novo ao
  // React e remontaria a subárvore — o Slider era destruído no meio do drag
  // (cada tick dispara setSettings), sem erro no console. Ver CLAUDE.md.
  const renderSettingsContent = () => (
    <>
      {/* Nav App Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App de Navegação</Text>
        <Text style={styles.settingDescription}>
          Escolha o app preferido para abrir rotas
        </Text>
        <View style={styles.navOptions}>
          {navOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.navOption,
                settings.preferredNavApp === option.value &&
                  styles.navOptionActive,
              ]}
              onPress={() =>
                handleSettingChange('preferredNavApp', option.value)
              }
            >
              <Text style={styles.navOptionIcon}>{option.icon}</Text>
              <Text
                style={[
                  styles.navOptionLabel,
                  settings.preferredNavApp === option.value &&
                    styles.navOptionLabelActive,
                ]}
              >
                {option.label}
              </Text>
              {settings.preferredNavApp === option.value && (
                <Text style={styles.navOptionCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Auto-advance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Modo Automático</Text>

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Avanço Automático</Text>
            <Text style={styles.settingDescription}>
              Avança para próxima parada automaticamente ao chegar
            </Text>
          </View>
          <Switch
            value={settings.autoAdvance}
            onValueChange={(value) => handleSettingChange('autoAdvance', value)}
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
          />
        </View>

        {settings.autoAdvance && (
          <View style={styles.sliderSetting}>
            <Text style={styles.sliderLabel}>
              Raio de Proximidade: {settings.proximityRadius}m
            </Text>
            <Text style={styles.sliderDescription}>
              Distância para considerar chegada ao destino
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={20}
              maximumValue={100}
              step={10}
              value={settings.proximityRadius}
              onValueChange={(value) =>
                handleSettingChange('proximityRadius', value)
              }
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray300}
              thumbTintColor={theme.colors.primary}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderEndLabel}>20m</Text>
              <Text style={styles.sliderEndLabel}>100m</Text>
            </View>
          </View>
        )}
      </View>

      {/* Navigation Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Navegação Interna</Text>

        <View style={[styles.setting, isWeb && styles.settingDisabled]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, isWeb && styles.disabledText]}>
              Navegação Turn-by-Turn
              {isWeb && ' (somente mobile)'}
            </Text>
            <Text
              style={[styles.settingDescription, isWeb && styles.disabledText]}
            >
              Instruções de direção dentro do app (economia de bateria)
            </Text>
          </View>
          <Switch
            value={settings.internalNavigation}
            onValueChange={(value) =>
              handleSettingChange('internalNavigation', value)
            }
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
            disabled={isWeb}
          />
        </View>

        {settings.internalNavigation && (
          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Navegação por Voz</Text>
              <Text style={styles.settingDescription}>
                Instruções de voz turn-by-turn
              </Text>
            </View>
            <Switch
              value={settings.voiceNavigation}
              onValueChange={(value) =>
                handleSettingChange('voiceNavigation', value)
              }
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Alertas Sonoros</Text>
            <Text style={styles.settingDescription}>
              Sons ao aproximar ou chegar ao destino
            </Text>
          </View>
          <Switch
            value={settings.soundAlerts}
            onValueChange={(value) => handleSettingChange('soundAlerts', value)}
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
          />
        </View>

        <View style={styles.setting}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Vibração</Text>
            <Text style={styles.settingDescription}>
              Vibrar ao chegar no destino
            </Text>
          </View>
          <Switch
            value={settings.vibrationAlerts}
            onValueChange={(value) =>
              handleSettingChange('vibrationAlerts', value)
            }
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
          />
        </View>
      </View>

      {/* Display Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exibição</Text>

        <View style={[styles.setting, isWeb && styles.settingDisabled]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, isWeb && styles.disabledText]}>
              Velocímetro
              {isWeb && ' (somente mobile)'}
            </Text>
            <Text
              style={[styles.settingDescription, isWeb && styles.disabledText]}
            >
              Mostrar velocidade atual durante navegação
            </Text>
          </View>
          <Switch
            value={settings.showSpeedometer}
            onValueChange={(value) =>
              handleSettingChange('showSpeedometer', value)
            }
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
            disabled={isWeb}
          />
        </View>

        <View style={[styles.setting, isWeb && styles.settingDisabled]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, isWeb && styles.disabledText]}>
              Manter Tela Ligada
              {isWeb && ' (somente mobile)'}
            </Text>
            <Text
              style={[styles.settingDescription, isWeb && styles.disabledText]}
            >
              Impedir que a tela desligue durante navegação
            </Text>
          </View>
          <Switch
            value={settings.preventScreenSleep}
            onValueChange={(value) =>
              handleSettingChange('preventScreenSleep', value)
            }
            trackColor={{
              false: theme.colors.gray300,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
            disabled={isWeb}
          />
        </View>
      </View>

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <View style={styles.tipHeader}>
          <Ionicons
            name="bulb-outline"
            size={20}
            color={theme.colors.warning}
          />
          <Text style={styles.tipTitle}>Dicas</Text>
        </View>
        <Text style={styles.tipText}>
          • O modo automático economiza tempo ao não precisar confirmar cada
          parada manualmente
        </Text>
        <Text style={styles.tipText}>
          • Ajuste o raio de proximidade baseado na precisão do GPS em sua
          região
        </Text>
        {!isWeb && (
          <Text style={styles.tipText}>
            • Mantenha a tela ligada para visualização contínua do mapa
          </Text>
        )}
        {isWeb && (
          <Text style={styles.tipText}>
            • Algumas opções estão disponíveis apenas no app mobile
          </Text>
        )}
      </View>

      {/* Reset Button */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleResetDefaults}
      >
        <Ionicons name="refresh" size={20} color={theme.colors.error} />
        <Text style={styles.resetButtonText}>Restaurar Padrões</Text>
      </TouchableOpacity>
    </>
  );

  // Inline variant - renders content directly
  if (variant === 'inline') {
    return (
      <>
        <View style={styles.inlineContainer}>{renderSettingsContent()}</View>
        {AlertDialog}
      </>
    );
  }

  // Modal variant - wraps content in a modal
  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        <View style={styles.backdrop}>
          {/* Backdrop pressable para fechar */}
          <Pressable style={styles.backdropPressable} onPress={onClose} />

          {/* Container do modal - View para não interferir no scroll */}
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Configurações de Navegação</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              bounces={false}
              nestedScrollEnabled={true}
            >
              {renderSettingsContent()}
              <View style={{ height: theme.spacing['12'] }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
      {AlertDialog}
    </>
  );
}

// Obter altura da tela para cálculo do modal
const { height: SCREEN_HEIGHT } = Dimensions.get('screen');

const styles = StyleSheet.create((theme: Theme) => ({
  // Inline container styles
  inlineContainer: {
    backgroundColor: theme.colors.white,
  },
  // Modal styles
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    // Android precisa de altura fixa, não percentual
    maxHeight: Platform.OS === 'android' ? SCREEN_HEIGHT * 0.85 : '90%',
    // Altura mínima para garantir que o conteúdo seja visível
    minHeight: Platform.OS === 'android' ? SCREEN_HEIGHT * 0.6 : 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing['4'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  title: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
  },
  closeButton: {
    padding: theme.spacing['2'],
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
  },
  contentContainer: {
    padding: theme.spacing['4'],
    paddingBottom: theme.spacing['8'],
  },
  // Section styles
  section: {
    marginBottom: theme.spacing['6'],
  },
  sectionTitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Setting row styles
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing['3'],
  },
  settingLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
    marginBottom: theme.spacing['0.5'],
  },
  settingDescription: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  settingDisabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: theme.colors.gray400,
  },
  // Nav app selector styles
  navOptions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  navOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  navOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  navOptionIcon: {
    fontSize: theme.typography.xl,
    marginRight: theme.spacing.md,
  },
  navOptionLabel: {
    flex: 1,
    fontSize: theme.typography.base,
    color: theme.colors.gray700,
  },
  navOptionLabelActive: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  navOptionCheck: {
    fontSize: theme.typography.lg,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansBold,
  },
  // Slider styles
  sliderSetting: {
    marginTop: theme.spacing['4'],
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  sliderLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  sliderDescription: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderEndLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
  },
  // Tips section
  tipsSection: {
    backgroundColor: theme.colors.warningBg,
    padding: theme.spacing['3'],
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing['6'],
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['2'],
    marginBottom: theme.spacing['2'],
  },
  tipTitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.secondaryDark,
  },
  tipText: {
    fontSize: theme.typography.xs,
    color: theme.colors.secondaryDark,
    marginBottom: theme.spacing.xs,
    paddingLeft: theme.spacing['7'],
  },
  // Reset button
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing['2'],
    paddingVertical: theme.spacing['3'],
    borderWidth: 1,
    borderColor: theme.colors.errorBg,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.errorBg,
  },
  resetButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.error,
  },
}));
