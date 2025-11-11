import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import LocationTrackingService from '@/services/locationTracking';
import { useUnistyles } from '@/utils/styles';

interface NavigationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export function NavigationSettings({ visible, onClose }: NavigationSettingsProps) {
  const { theme } = useUnistyles();
  const [settings, setSettings] = useState({
    autoAdvance: true,
    soundAlerts: true,
    vibrationAlerts: true,
    proximityRadius: 50,
    showSpeedometer: true,
    preventScreenSleep: true,
    voiceNavigation: false,
    internalNavigation: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const prefs = await LocationTrackingService.getNavigationPreferences();
    setSettings(prev => ({
      ...prev,
      autoAdvance: prefs.autoAdvance ?? true,
      soundAlerts: prefs.soundAlerts ?? true,
      vibrationAlerts: prefs.vibrationAlerts ?? true,
      proximityRadius: prefs.proximityRadius ?? 50,
    }));
  };

  const handleSettingChange = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to preferences
    await LocationTrackingService.updateNavigationPreferences({
      [key]: value,
    });
  };

  const handleResetDefaults = () => {
    Alert.alert(
      'Restaurar Padrões',
      'Deseja restaurar todas as configurações para os valores padrão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            const defaults = {
              autoAdvance: true,
              soundAlerts: true,
              vibrationAlerts: true,
              proximityRadius: 50,
              showSpeedometer: true,
              preventScreenSleep: true,
              voiceNavigation: false,
            };
            setSettings(defaults);
            await LocationTrackingService.updateNavigationPreferences(defaults);
            Alert.alert('Sucesso', 'Configurações restauradas');
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configurações de Navegação</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
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
                onValueChange={(value) => handleSettingChange('proximityRadius', value)}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor="#d1d5db"
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
          <Text style={styles.sectionTitle}>Navegação</Text>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Navegação Interna</Text>
              <Text style={styles.settingDescription}>
                Turn-by-turn dentro do app (economia de bateria)
              </Text>
            </View>
            <Switch
              value={settings.internalNavigation}
              onValueChange={(value) => handleSettingChange('internalNavigation', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
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
                onValueChange={(value) => handleSettingChange('voiceNavigation', value)}
                trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
                thumbColor="#fff"
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
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
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
              onValueChange={(value) => handleSettingChange('vibrationAlerts', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Display Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exibição</Text>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Velocímetro</Text>
              <Text style={styles.settingDescription}>
                Mostrar velocidade atual durante navegação
              </Text>
            </View>
            <Switch
              value={settings.showSpeedometer}
              onValueChange={(value) => handleSettingChange('showSpeedometer', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Manter Tela Ligada</Text>
              <Text style={styles.settingDescription}>
                Impedir que a tela desligue durante navegação
              </Text>
            </View>
            <Switch
              value={settings.preventScreenSleep}
              onValueChange={(value) => handleSettingChange('preventScreenSleep', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.tipTitle}>Dicas</Text>
          </View>
          <Text style={styles.tipText}>
            • O modo automático economiza tempo ao não precisar confirmar cada parada manualmente
          </Text>
          <Text style={styles.tipText}>
            • Ajuste o raio de proximidade baseado na precisão do GPS em sua região
          </Text>
          <Text style={styles.tipText}>
            • Mantenha a tela ligada para visualização contínua do mapa
          </Text>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleResetDefaults}>
          <Ionicons name="refresh" size={20} color={theme.colors.error} />
          <Text style={styles.resetButtonText}>Restaurar Padrões</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6b7280',
  },
  sliderSetting: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  sliderDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
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
    fontSize: 11,
    color: '#9ca3af',
  },
  tipsSection: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  tipText: {
    fontSize: 12,
    color: '#92400e',
    marginBottom: 4,
    paddingLeft: 28,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },
});