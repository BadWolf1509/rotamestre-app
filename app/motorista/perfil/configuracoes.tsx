import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';

import { ThemeSettings } from '@/components/ThemeSettings';
import { MobileCard, Text } from '@/design-system';
import { getAppVersion, getBuildNumber, getPlatformName } from '@/lib/appVersion';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

// Storage keys
const STORAGE_KEYS = {
  NAV_APP: '@rotamestre:nav_app_preference',
  NOTIFICATIONS_ENABLED: '@rotamestre:notifications_enabled',
  SOUND_ENABLED: '@rotamestre:sound_enabled',
};

type NavAppPreference = 'waze' | 'google_maps' | 'apple_maps' | 'default';

const NAV_APP_OPTIONS: { value: NavAppPreference; label: string; icon: string; platform?: string }[] = [
  { value: 'default', label: 'Padrão do Sistema', icon: '📱' },
  { value: 'waze', label: 'Waze', icon: '🗺️' },
  { value: 'google_maps', label: 'Google Maps', icon: '🌍' },
  { value: 'apple_maps', label: 'Apple Maps', icon: '🍎', platform: 'ios' },
];

export default function ConfiguracoesScreen() {
  const { theme } = useUnistyles();

  const [navAppPreference, setNavAppPreference] = useState<NavAppPreference>('default');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  // Load settings from AsyncStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const [navApp, notifications, sound] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.NAV_APP),
          AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
          AsyncStorage.getItem(STORAGE_KEYS.SOUND_ENABLED),
        ]);

        if (navApp) setNavAppPreference(navApp as NavAppPreference);
        if (notifications !== null) setNotificationsEnabled(notifications === 'true');
        if (sound !== null) setSoundEnabled(sound === 'true');

        // Estimate cache size
        const keys = await AsyncStorage.getAllKeys();
        setCacheSize(`~${keys.length} itens`);
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function saveNavAppPreference(value: NavAppPreference) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NAV_APP, value);
      setNavAppPreference(value);
    } catch (error) {
      console.error('Erro ao salvar preferência de navegação:', error);
      Alert.alert('Erro', 'Não foi possível salvar a preferência.');
    }
  }

  async function toggleNotifications(value: boolean) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(value));
      setNotificationsEnabled(value);
    } catch (error) {
      console.error('Erro ao salvar configuração de notificações:', error);
    }
  }

  async function toggleSound(value: boolean) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(value));
      setSoundEnabled(value);
    } catch (error) {
      console.error('Erro ao salvar configuração de som:', error);
    }
  }

  async function handleClearCache() {
    Alert.alert(
      'Limpar Cache',
      'Isso irá remover dados temporários do app. Você precisará fazer login novamente. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all keys except auth keys
              const keys = await AsyncStorage.getAllKeys();
              const keysToRemove = keys.filter(
                (k) => !k.includes('supabase') && !k.includes('auth')
              );
              await AsyncStorage.multiRemove(keysToRemove);
              setCacheSize('0 itens');
              Alert.alert('Sucesso', 'Cache limpo com sucesso!');
            } catch (error) {
              console.error('Erro ao limpar cache:', error);
              Alert.alert('Erro', 'Não foi possível limpar o cache.');
            }
          },
        },
      ]
    );
  }

  // Filter nav options based on platform
  const navOptions = NAV_APP_OPTIONS.filter(
    (opt) => !opt.platform || opt.platform === Platform.OS
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
        {/* Navegação */}
        <MobileCard title="Navegação">
          <Text style={styles.settingDescription}>
            Escolha o app de navegação preferido para abrir rotas
          </Text>
          <View style={styles.navOptions}>
            {navOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.navOption,
                  navAppPreference === option.value && styles.navOptionActive,
                ]}
                onPress={() => saveNavAppPreference(option.value)}
              >
                <Text style={styles.navOptionIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.navOptionLabel,
                    navAppPreference === option.value && styles.navOptionLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
                {navAppPreference === option.value && (
                  <Text style={styles.navOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </MobileCard>

        {/* Notificações */}
        <MobileCard title="Notificações">
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notificações Push</Text>
              <Text style={styles.settingSubtext}>
                Receber alertas de novas rotas e atualizações
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.colors.gray300, true: theme.colors.primary + '60' }}
              thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.gray400}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sons</Text>
              <Text style={styles.settingSubtext}>
                Tocar som ao receber notificações
              </Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={toggleSound}
              trackColor={{ false: theme.colors.gray300, true: theme.colors.primary + '60' }}
              thumbColor={soundEnabled ? theme.colors.primary : theme.colors.gray400}
              disabled={!notificationsEnabled}
            />
          </View>
        </MobileCard>

        {/* Aparência - Using unified ThemeSettings component */}
        <View style={styles.themeSettingsWrapper}>
          <ThemeSettings showPreview={true} compact={true} />
        </View>

        {/* Dados */}
        <MobileCard title="Dados e Armazenamento">
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleClearCache}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Limpar Cache</Text>
              <Text style={styles.settingSubtext}>
                Cache atual: {cacheSize || 'Calculando...'}
              </Text>
            </View>
            <Text style={styles.settingAction}>Limpar</Text>
          </TouchableOpacity>
        </MobileCard>

        {/* Sobre */}
        <MobileCard title="Sobre o App">
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Versão</Text>
            <Text style={styles.aboutValue}>{getAppVersion()}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Plataforma</Text>
            <Text style={styles.aboutValue}>{getPlatformName()}</Text>
          </View>
          <View style={[styles.aboutRow, styles.aboutRowLast]}>
            <Text style={styles.aboutLabel}>Build</Text>
            <Text style={styles.aboutValue}>{getBuildNumber()}</Text>
          </View>
        </MobileCard>

        <View style={styles.footer} />
      </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.gray500,
  },
  themeSettingsWrapper: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  navOptions: {
    gap: theme.spacing.sm,
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
    fontSize: 20,
    marginRight: theme.spacing.md,
  },
  navOptionLabel: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.gray700,
  },
  navOptionLabelActive: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  navOptionCheck: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.gray900,
  },
  settingSubtext: {
    fontSize: 13,
    color: theme.colors.gray500,
    marginTop: 2,
  },
  settingAction: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.error,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  aboutRowLast: {
    borderBottomWidth: 0,
  },
  aboutLabel: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray900,
  },
  footer: {
    height: 40,
  },
}));

