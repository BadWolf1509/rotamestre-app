import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavigationSettings } from '@/components/motorista/NavigationSettings';
import { ThemeSettings } from '@/components/ThemeSettings';
import { MobileCard, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { getAppVersion, getBuildNumber, getPlatformName } from '@/lib/appVersion';
import { logger } from '@/lib/logger';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

// Storage keys (only for settings NOT managed by NavigationSettings)
const STORAGE_KEYS = {
  NOTIFICATIONS_ENABLED: '@rotamestre:notifications_enabled',
};

export default function ConfiguracoesScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showConfirm, AlertDialog } = useAlert();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  // Load settings from AsyncStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const notifications = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);

        if (notifications !== null) setNotificationsEnabled(notifications === 'true');

        // Estimate cache size
        const keys = await AsyncStorage.getAllKeys();
        setCacheSize(`~${keys.length} itens`);
      } catch (error) {
        logger.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function toggleNotifications(value: boolean) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, String(value));
      setNotificationsEnabled(value);
    } catch (error) {
      logger.error('Erro ao salvar configuração de notificações:', error);
    }
  }

  async function handleClearCache() {
    const confirmed = await showConfirm({
      title: 'Limpar Cache',
      message: 'Isso irá remover dados temporários do app. Você precisará fazer login novamente. Deseja continuar?',
      confirmText: 'Limpar',
      cancelText: 'Cancelar',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      // Get all keys except auth keys
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(
        (k) => !k.includes('supabase') && !k.includes('auth')
      );
      await AsyncStorage.multiRemove(keysToRemove);
      setCacheSize('0 itens');
      showSuccess('Sucesso', 'Cache limpo com sucesso!');
    } catch (error) {
      logger.error('Erro ao limpar cache:', error);
      showError({ title: 'Erro', message: 'Não foi possível limpar o cache.' });
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom + 20) }}
    >
      {/* Navegação - Usando NavigationSettings inline */}
      <MobileCard title="Navegação">
        <NavigationSettings variant="inline" />
      </MobileCard>

      {/* Notificações Push - Simplificado */}
      <MobileCard title="Notificações">
        <View style={[styles.settingRow, styles.settingRowLast]}>
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

      {/* Suporte */}
      <MobileCard title="Suporte">
        <TouchableOpacity
          style={[styles.supportRow, styles.settingRowLast]}
          onPress={() => router.push('/motorista/ajuda')}
        >
          <View style={styles.supportIcon}>
            <Ionicons name="help-circle-outline" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Central de Ajuda</Text>
            <Text style={styles.settingSubtext}>
              FAQ, contatos e links úteis
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
        </TouchableOpacity>
      </MobileCard>

      <View style={styles.footer} />
      {AlertDialog}
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
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
  },
  themeSettingsWrapper: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
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
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
  },
  settingSubtext: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
  },
  settingAction: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
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
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  aboutValue: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansMedium,
    color: theme.colors.gray900,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  footer: {
    height: theme.spacing['3xl'],
  },
}));
