import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeSettings } from '@/components/ThemeSettings';
import { MobileCard, Text, Toast } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { usePreferenciasPush } from '@/hooks/usePreferenciasPush';
import { useToast } from '@/hooks/useToast';
import {
  getAppVersion,
  getBuildNumber,
  getPlatformName,
} from '@/lib/appVersion';
import {
  chavesParaLimparNoCache,
  MENSAGEM_LIMPAR_CACHE,
} from '@/lib/limpezaDeCache';
import { AVISO_PREFERENCIA_SEM_REDE } from '@/lib/notificacoes/preferenciasPush';
import type { PreferenciasNotificacao } from '@/types/notifications';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

// Storage keys (as preferências de push moram no banco desde a Migration 47;
// as chaves antigas migram uma vez em src/lib/notificacoes/preferenciasPush.ts)
const STORAGE_KEYS = {
  DASHBOARD_AUTO_REFRESH: '@rotamestre:gestor:dashboard_auto_refresh',
  EXPORT_FORMAT: '@rotamestre:gestor:export_format',
};

type ExportFormat = 'csv';

const EXPORT_OPTIONS: { value: ExportFormat; label: string; icon: string }[] = [
  { value: 'csv', label: 'CSV (Excel)', icon: '📊' },
];

export default function ConfiguracoesGestorScreen() {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showConfirm, AlertDialog } = useAlert();
  const { toast, showToast, hideToast } = useToast();
  // Preferências no banco (Migration 47), lidas pela Edge Function de push.
  const {
    preferencias,
    carregando: carregandoPreferencias,
    alterar: alterarPreferencia,
  } = usePreferenciasPush();
  const notificationsEnabled = preferencias.push_ativo;
  const incidentAlerts = preferencias.incidentes;
  const routeUpdates = preferencias.rotas;
  const dailySummary = preferencias.resumo_diario;

  const [dashboardAutoRefresh, setDashboardAutoRefresh] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  // Load settings from AsyncStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const [autoRefresh, format] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.DASHBOARD_AUTO_REFRESH),
          AsyncStorage.getItem(STORAGE_KEYS.EXPORT_FORMAT),
        ]);

        if (autoRefresh !== null)
          setDashboardAutoRefresh(autoRefresh === 'true');
        if (format) setExportFormat(format as ExportFormat);

        // Estimate cache size
        const keys = await AsyncStorage.getAllKeys();
        setCacheSize(`~${keys.length} itens`);
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Muda na hora; a gravação corre por trás. Sem rede, a escolha fica no
  // aparelho e sobe depois — a tela só avisa.
  async function alternar(
    campo: keyof PreferenciasNotificacao,
    value: boolean,
  ) {
    const { sincronizado } = await alterarPreferencia(campo, value);
    if (!sincronizado) showToast(AVISO_PREFERENCIA_SEM_REDE, 'info', 5000);
  }
  const toggleNotifications = (v: boolean) => alternar('push_ativo', v);
  const toggleIncidentAlerts = (v: boolean) => alternar('incidentes', v);
  const toggleRouteUpdates = (v: boolean) => alternar('rotas', v);
  const toggleDailySummary = (v: boolean) => alternar('resumo_diario', v);

  async function toggleDashboardAutoRefresh(value: boolean) {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.DASHBOARD_AUTO_REFRESH,
        String(value),
      );
      setDashboardAutoRefresh(value);
    } catch {
      // Silent fail
    }
  }

  async function saveExportFormat(value: ExportFormat) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_FORMAT, value);
      setExportFormat(value);
    } catch {
      showError({
        title: 'Erro',
        message: 'Não foi possível salvar a preferência.',
      });
    }
  }

  async function handleClearCache() {
    const confirmed = await showConfirm({
      title: 'Limpar Cache',
      message: MENSAGEM_LIMPAR_CACHE,
      confirmText: 'Limpar',
      cancelText: 'Cancelar',
      type: 'danger',
    });

    if (!confirmed) return;

    try {
      const keys = await AsyncStorage.getAllKeys();
      // Preserva sessão, fila de ações offline e fotos pendentes.
      const keysToRemove = chavesParaLimparNoCache(keys);
      await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
      setCacheSize('0 itens');
      showSuccess('Sucesso', 'Cache limpo com sucesso!');
    } catch {
      showError({ title: 'Erro', message: 'Não foi possível limpar o cache.' });
    }
  }

  if (loading || carregandoPreferencias) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        {/* Notificações */}
        <MobileCard title="Notificações">
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notificações Push</Text>
              <Text style={styles.settingSubtext}>
                Ativar todas as notificações
              </Text>
            </View>
            <Switch
              testID="switch-push-ativo"
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                notificationsEnabled
                  ? theme.colors.primary
                  : theme.colors.gray400
              }
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Alertas de Incidentes</Text>
              <Text style={styles.settingSubtext}>
                Receber notificação quando motorista reportar incidente
              </Text>
            </View>
            <Switch
              testID="switch-incidentes"
              value={incidentAlerts}
              onValueChange={toggleIncidentAlerts}
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                incidentAlerts ? theme.colors.primary : theme.colors.gray400
              }
              disabled={!notificationsEnabled}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Atualizações de Rotas</Text>
              <Text style={styles.settingSubtext}>
                Receber notificação quando rota for concluída ou atualizada
              </Text>
            </View>
            <Switch
              testID="switch-rotas"
              value={routeUpdates}
              onValueChange={toggleRouteUpdates}
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                routeUpdates ? theme.colors.primary : theme.colors.gray400
              }
              disabled={!notificationsEnabled}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Resumo Diário</Text>
              <Text style={styles.settingSubtext}>
                Receber relatório resumido ao final do dia
              </Text>
            </View>
            <Switch
              testID="switch-resumo-diario"
              value={dailySummary}
              onValueChange={toggleDailySummary}
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                dailySummary ? theme.colors.primary : theme.colors.gray400
              }
              disabled={!notificationsEnabled}
            />
          </View>
        </MobileCard>

        {/* Dashboard */}
        <MobileCard title="Dashboard">
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Atualização Automática</Text>
              <Text style={styles.settingSubtext}>
                Atualizar dados do dashboard em tempo real
              </Text>
            </View>
            <Switch
              value={dashboardAutoRefresh}
              onValueChange={toggleDashboardAutoRefresh}
              trackColor={{
                false: theme.colors.gray300,
                true: theme.colors.primary + '60',
              }}
              thumbColor={
                dashboardAutoRefresh
                  ? theme.colors.primary
                  : theme.colors.gray400
              }
            />
          </View>
        </MobileCard>

        {/* Relatórios */}
        <MobileCard title="Relatórios">
          <Text style={styles.settingDescription}>
            Formato padrão para exportação de relatórios
          </Text>
          <View style={styles.navOptions}>
            {EXPORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.navOption,
                  exportFormat === option.value && styles.navOptionActive,
                ]}
                onPress={() => saveExportFormat(option.value)}
              >
                <Text style={styles.navOptionIcon}>{option.icon}</Text>
                <Text
                  style={[
                    styles.navOptionLabel,
                    exportFormat === option.value &&
                      styles.navOptionLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
                {exportFormat === option.value && (
                  <Text style={styles.navOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </MobileCard>

        {/* Aparência */}
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
        {AlertDialog}
      </ScrollView>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        onDismiss={hideToast}
      />
    </ErrorBoundary>
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
  settingDescription: {
    fontSize: theme.typography.sm,
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
  footer: {
    height: theme.spacing['3xl'],
  },
}));
