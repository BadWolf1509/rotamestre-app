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
import { avisoDaGravacao } from '@/lib/notificacoes/preferenciasPush';
import type { PreferenciasNotificacao } from '@/types/notifications';
import { coresDoSwitch } from '@/utils/coresDoSwitch';
import { StyleSheet, type Theme, useUnistyles } from '@/utils/styles';

// As preferências de push moram no banco desde a Migration 47 (as chaves
// antigas do aparelho migram uma vez em src/lib/notificacoes/preferenciasPush.ts).
// A "Atualização Automática" do dashboard e o "Formato padrão" de exportação
// saíram: ninguém lia essas chaves.

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

  const [loading, setLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState<string | null>(null);

  // Estimativa do cache local (itens no AsyncStorage).
  useEffect(() => {
    async function loadSettings() {
      try {
        const keys = await AsyncStorage.getAllKeys();
        setCacheSize(`~${keys.length} itens`);
      } catch {
        // Sem a estimativa a tela segue; o campo fica vazio.
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
    const aviso = avisoDaGravacao(await alterarPreferencia(campo, value));
    if (aviso) showToast(aviso.mensagem, aviso.tipo, 5000);
  }
  const toggleNotifications = (v: boolean) => alternar('push_ativo', v);
  const toggleIncidentAlerts = (v: boolean) => alternar('incidentes', v);
  const toggleRouteUpdates = (v: boolean) => alternar('rotas', v);
  const toggleDailySummary = (v: boolean) => alternar('resumo_diario', v);

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
              {...coresDoSwitch(theme, notificationsEnabled)}
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
              {...coresDoSwitch(theme, incidentAlerts)}
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
              {...coresDoSwitch(theme, routeUpdates)}
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
              {...coresDoSwitch(theme, dailySummary)}
              disabled={!notificationsEnabled}
            />
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
