import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';

import { usePerformance } from '@/hooks/usePerformance';
import { formatBytes } from '@/lib/utils';
import PerformanceOptimizer from '@/services/performanceOptimizer';
import { useUnistyles } from '@/utils/styles';

interface PerformanceSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export function PerformanceSettings({ visible, onClose }: PerformanceSettingsProps) {
  const { theme } = useUnistyles();
  const { metrics, clearCache, getPerformanceReport } = usePerformance();
  const [settings, setSettings] = useState({
    enableLazyLoading: true,
    enableImageOptimization: true,
    enableDataCaching: true,
    enableBatchRequests: true,
    enableOfflineMode: true,
    cacheSize: 50, // MB
    cacheTTL: 5, // minutes
  });
  const [isLoading, setIsLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ size: 0, items: 0 });

  useEffect(() => {
    loadSettings();
    calculateCacheInfo();
  }, []);

  const loadSettings = async () => {
    const optimizer = PerformanceOptimizer;
    const currentSettings = optimizer.getSettings();
    setSettings({
      enableLazyLoading: currentSettings.enableLazyLoading,
      enableImageOptimization: currentSettings.enableImageOptimization,
      enableDataCaching: currentSettings.enableDataCaching,
      enableBatchRequests: currentSettings.enableBatchRequests,
      enableOfflineMode: currentSettings.enableOfflineMode,
      cacheSize: currentSettings.cacheConfig.maxSize,
      cacheTTL: currentSettings.cacheConfig.ttl / 60000, // Convert to minutes
    });
  };

  const calculateCacheInfo = async () => {
    // This would need implementation to actually calculate cache size
    setCacheInfo({
      size: Math.random() * 30 * 1024 * 1024, // Mock size in bytes
      items: Math.floor(Math.random() * 100),
    });
  };

  const handleSettingChange = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Update optimizer settings
    const optimizerSettings: any = {
      enableLazyLoading: newSettings.enableLazyLoading,
      enableImageOptimization: newSettings.enableImageOptimization,
      enableDataCaching: newSettings.enableDataCaching,
      enableBatchRequests: newSettings.enableBatchRequests,
      enableOfflineMode: newSettings.enableOfflineMode,
    };

    if (key === 'cacheSize') {
      optimizerSettings.cacheConfig = {
        maxSize: value,
        ttl: settings.cacheTTL * 60000,
        strategy: 'LRU',
      };
    } else if (key === 'cacheTTL') {
      optimizerSettings.cacheConfig = {
        maxSize: settings.cacheSize,
        ttl: value * 60000,
        strategy: 'LRU',
      };
    }

    await PerformanceOptimizer.updateSettings(optimizerSettings);
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Limpar Cache',
      'Isso removerá todos os dados em cache. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await clearCache();
            await calculateCacheInfo();
            setIsLoading(false);
            Alert.alert('Sucesso', 'Cache limpo com sucesso!');
          },
        },
      ]
    );
  };

  const handleRunDiagnostics = () => {
    const report = getPerformanceReport();
    const avgApiTime = Object.values(report.apiResponseTime)
      .flat()
      .reduce((a, b) => a + b, 0) /
      Object.values(report.apiResponseTime).flat().length || 0;

    Alert.alert(
      'Relatório de Performance',
      `Memória em uso: ${report.memoryUsage.toFixed(2)} MB\n` +
      `Framerate JS: ${report.jsFramerate} FPS\n` +
      `Tempo médio de API: ${avgApiTime.toFixed(0)}ms\n` +
      `Telas carregadas: ${Object.keys(report.screenLoadTime).length}\n` +
      `Conexão: ${metrics.isOnline ? 'Online' : 'Offline'} (${metrics.connectionType || 'Unknown'})`
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Configurações de Performance</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} testID="close-button">
          <Ionicons name="close" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={Platform.OS === 'web'}>
        {/* Performance Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Memória</Text>
            <Text style={styles.statusValue}>{metrics.memoryUsage.toFixed(1)} MB</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Cache</Text>
            <Text style={styles.statusValue}>
              {formatBytes(cacheInfo.size)} ({cacheInfo.items} items)
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Conexão</Text>
            <Text style={[
              styles.statusValue,
              { color: metrics.isOnline ? theme.colors.success : theme.colors.error }
            ]}>
              {metrics.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Optimization Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Otimizações</Text>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Carregamento Preguiçoso</Text>
              <Text style={styles.settingDescription}>
                Carrega conteúdo conforme necessário
              </Text>
            </View>
            <Switch
              value={settings.enableLazyLoading}
              onValueChange={(value) => handleSettingChange('enableLazyLoading', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Otimização de Imagens</Text>
              <Text style={styles.settingDescription}>
                Comprime e redimensiona imagens automaticamente
              </Text>
            </View>
            <Switch
              value={settings.enableImageOptimization}
              onValueChange={(value) => handleSettingChange('enableImageOptimization', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Requisições em Lote</Text>
              <Text style={styles.settingDescription}>
                Agrupa múltiplas requisições em uma só
              </Text>
            </View>
            <Switch
              value={settings.enableBatchRequests}
              onValueChange={(value) => handleSettingChange('enableBatchRequests', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Cache Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache</Text>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Cache de Dados</Text>
              <Text style={styles.settingDescription}>
                Armazena dados para acesso rápido
              </Text>
            </View>
            <Switch
              value={settings.enableDataCaching}
              onValueChange={(value) => handleSettingChange('enableDataCaching', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {settings.enableDataCaching && (
            <>
              <View style={styles.sliderSetting}>
                <Text style={styles.sliderLabel}>
                  Tamanho do Cache: {settings.cacheSize} MB
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={10}
                  maximumValue={100}
                  step={10}
                  value={settings.cacheSize}
                  onValueChange={(value) => handleSettingChange('cacheSize', value)}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor={theme.colors.primary}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderEndLabel}>10 MB</Text>
                  <Text style={styles.sliderEndLabel}>100 MB</Text>
                </View>
              </View>

              <View style={styles.sliderSetting}>
                <Text style={styles.sliderLabel}>
                  Validade do Cache: {settings.cacheTTL} min
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={1}
                  maximumValue={60}
                  step={1}
                  value={settings.cacheTTL}
                  onValueChange={(value) => handleSettingChange('cacheTTL', value)}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor="#d1d5db"
                  thumbTintColor={theme.colors.primary}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderEndLabel}>1 min</Text>
                  <Text style={styles.sliderEndLabel}>60 min</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Offline Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modo Offline</Text>

          <View style={styles.setting}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Modo Offline</Text>
              <Text style={styles.settingDescription}>
                Permite uso do app sem conexão
              </Text>
            </View>
            <Switch
              value={settings.enableOfflineMode}
              onValueChange={(value) => handleSettingChange('enableOfflineMode', value)}
              trackColor={{ false: '#d1d5db', true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleClearCache}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.buttonText, { color: theme.colors.primary }]}>
                  Limpar Cache
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primaryDark },
            ]}
            onPress={handleRunDiagnostics}
          >
            <Ionicons name="analytics-outline" size={20} color="#fff" />
            <Text style={[styles.buttonText, { color: '#fff' }]}>
              Diagnóstico
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.tipTitle}>Dicas de Performance</Text>
          </View>
          <Text style={styles.tipText}>
            • Ative o cache para reduzir uso de dados móveis
          </Text>
          <Text style={styles.tipText}>
            • Use modo offline em áreas com sinal fraco
          </Text>
          <Text style={styles.tipText}>
            • Limpe o cache periodicamente para liberar espaço
          </Text>
          <Text style={styles.tipText}>
            • Desative otimizações se encontrar problemas
          </Text>
        </View>

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
  statusCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
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
});
