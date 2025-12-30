import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';

import { AvatarEditable } from '@/components/AvatarEditable';
import {
  getThemePreferences,
  setContrastPreference,
  setDensityPreference,
  setThemePreference,
} from '@/lib/themePreference';
import { StyleSheet, useUnistyles } from '@/utils/styles';

interface PerfilDesktopLayoutProps {
  usuario: any;
  uploadingPhoto?: boolean;
  onSelectPhoto?: () => void;
  atividade?: {
    ultimoAcesso: string | null;
    dispositivosAtivos: number | null;
  };
  children?: React.ReactNode;
  onLogout?: () => void;
}

export function PerfilDesktopLayout({
  usuario,
  uploadingPhoto,
  onSelectPhoto,
  atividade,
  children,
  onLogout,
}: PerfilDesktopLayoutProps) {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [darkModeEnabled, setDarkModeEnabled] = React.useState(false);
  const [compactDensityEnabled, setCompactDensityEnabled] = React.useState(false);
  const [highContrastEnabled, setHighContrastEnabled] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    const loadPreferences = async () => {
      const stored = await getThemePreferences();
      if (!mounted || !stored) {
        return;
      }

      setDarkModeEnabled(stored.mode === 'dark');
      setCompactDensityEnabled(stored.density === 'compact');
      setHighContrastEnabled(stored.contrast === 'high');
    };

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Nunca registrado';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Data indisponível';
    }
    return Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  };

  const formatDevices = (value?: number | null) => {
    if (value == null) return 'Indisponível';
    return value === 1 ? '1 dispositivo' : `${value} dispositivos`;
  };


  const handleDarkModeToggle = async (value: boolean) => {
    setDarkModeEnabled(value);
    try {
      await setThemePreference(value ? 'dark' : 'light');
    } catch (error) {
      console.warn('Failed to update theme preference:', error);
    }
  };

  const handleDensityToggle = async (value: boolean) => {
    setCompactDensityEnabled(value);
    try {
      await setDensityPreference(value ? 'compact' : 'regular');
    } catch (error) {
      console.warn('Failed to update density preference:', error);
    }
  };

  const handleContrastToggle = async (value: boolean) => {
    setHighContrastEnabled(value);
    try {
      await setContrastPreference(value ? 'high' : 'normal');
    } catch (error) {
      console.warn('Failed to update contrast preference:', error);
    }
  };

  return (
    <View style={styles(theme).wrapper}>
      <View style={styles(theme).sidebar}>
        <View style={styles(theme).profileCard}>
          <AvatarEditable
            name={usuario?.nome || 'Usuário'}
            imageUrl={usuario?.foto_url}
            size="xxl"
            onPress={onSelectPhoto}
            uploading={uploadingPhoto}
          />

          <Text style={styles(theme).userName}>{usuario?.nome || 'Usuário'}</Text>
          <Text style={styles(theme).userEmail}>{usuario?.email || ''}</Text>

          <View style={styles(theme).roleBadge}>
            <Text style={styles(theme).roleBadgeText}>
              {usuario?.papel === 'gestor' ? 'Gestor' : 'Motorista'}
            </Text>
          </View>

          {usuario?.unidades?.nome && (
            <View style={styles(theme).unitInfo}>
              <Ionicons name="business-outline" size={16} color={theme.colors.gray500} />
              <Text style={styles(theme).unitName}>{usuario.unidades.nome}</Text>
            </View>
          )}

          <View style={styles(theme).divider} />

          <View style={styles(theme).quickActions}>
            <TouchableOpacity
              style={styles(theme).quickAction}
              onPress={() => router.push('/perfil/editar')}
            >
              <Ionicons name="person-outline" size={20} color={theme.colors.gray600} />
              <Text style={styles(theme).quickActionText}>Editar Perfil</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.gray400} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).quickAction}
              onPress={() => router.push('/perfil/trocar-senha')}
            >
              <Ionicons name="lock-closed-outline" size={20} color={theme.colors.gray600} />
              <Text style={styles(theme).quickActionText}>Alterar Senha</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.gray400} />
            </TouchableOpacity>

            {onLogout && (
              <TouchableOpacity
                style={[styles(theme).quickAction, styles(theme).logoutAction]}
                onPress={onLogout}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                <Text style={[styles(theme).quickActionText, styles(theme).logoutText]}>Sair</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles(theme).settingsCard}>
          <Text style={styles(theme).settingsTitle}>Aparencia</Text>
          <View style={styles(theme).settingsRow}>
            <Text style={styles(theme).settingsLabel}>Tema escuro</Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
              thumbColor={darkModeEnabled ? theme.colors.white : theme.colors.gray100}
            />
          </View>
          <View style={styles(theme).settingsRow}>
            <Text style={styles(theme).settingsLabel}>Densidade compacta</Text>
            <Switch
              value={compactDensityEnabled}
              onValueChange={handleDensityToggle}
              trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
              thumbColor={compactDensityEnabled ? theme.colors.white : theme.colors.gray100}
            />
          </View>
          <View style={[styles(theme).settingsRow, styles(theme).settingsRowLast]}>
            <Text style={styles(theme).settingsLabel}>Alto contraste</Text>
            <Switch
              value={highContrastEnabled}
              onValueChange={handleContrastToggle}
              trackColor={{ false: theme.colors.gray300, true: theme.colors.primary }}
              thumbColor={highContrastEnabled ? theme.colors.white : theme.colors.gray100}
            />
          </View>
        </View>
      </View>

      <View style={styles(theme).contentArea}>
        {children ? (
          children
        ) : (
          <View style={styles(theme).infoCards}>
            <View style={styles(theme).infoCard}>
              <View style={styles(theme).cardHeader}>
                <Ionicons name="person" size={20} color={theme.colors.primary} />
                <Text style={styles(theme).cardTitle}>Informações Pessoais</Text>
              </View>
              <View style={styles(theme).cardContent}>
                <View style={styles(theme).infoRow}>
                  <Text style={styles(theme).infoLabel}>Nome Completo</Text>
                  <Text style={styles(theme).infoValue}>{usuario?.nome || 'Não informado'}</Text>
                </View>
                <View style={styles(theme).infoRow}>
                  <Text style={styles(theme).infoLabel}>Email</Text>
                  <Text style={styles(theme).infoValue}>{usuario?.email || 'Não informado'}</Text>
                </View>
                <View style={styles(theme).infoRow}>
                  <Text style={styles(theme).infoLabel}>Telefone</Text>
                  <Text style={styles(theme).infoValue}>{usuario?.telefone || 'Não informado'}</Text>
                </View>
              </View>
            </View>

            <View style={styles(theme).infoCard}>
              <View style={styles(theme).cardHeader}>
                <Ionicons name="time" size={20} color={theme.colors.blue500} />
                <Text style={styles(theme).cardTitle}>Atividade Recente</Text>
              </View>
              <View style={styles(theme).cardContent}>
                <View style={styles(theme).infoRow}>
                  <Text style={styles(theme).infoLabel}>Último acesso</Text>
                  <Text style={styles(theme).infoValue}>{formatDateTime(atividade?.ultimoAcesso)}</Text>
                </View>
                <View style={styles(theme).infoRow}>
                  <Text style={styles(theme).infoLabel}>Dispositivos ativos</Text>
                  <Text style={styles(theme).infoValue}>{formatDevices(atividade?.dispositivosAtivos)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      gap: 32,
      width: '100%',
    },
    sidebar: {
      width: 320,
    },
    profileCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.gray100,
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    userName: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.gray900,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: theme.colors.gray500,
      marginBottom: 12,
    },
    roleBadge: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.colors.blue50,
      marginBottom: 12,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.blue500,
    },
    unitInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    unitName: {
      fontSize: 14,
      color: theme.colors.gray600,
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: theme.colors.gray200,
      marginVertical: 20,
    },
    quickActions: {
      width: '100%',
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginBottom: 4,
      gap: 12,
    },
    quickActionText: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.gray700,
    },
    logoutAction: {
      marginTop: 8,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.gray200,
    },
    logoutText: {
      color: theme.colors.error,
    },
    contentArea: {
      flex: 1,
    },
    infoCards: {
      gap: 24,
    },
    infoCard: {
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 24,
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.gray900,
    },
    cardContent: {
      gap: 12,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    infoLabel: {
      fontSize: 14,
      color: theme.colors.gray500,
    },
    infoValue: {
      fontSize: 14,
      color: theme.colors.gray900,
      textAlign: 'right',
    },
    settingsCard: {
      marginTop: 24,
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.gray100,
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    settingsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.gray900,
      marginBottom: 12,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    settingsRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    settingsLabel: {
      fontSize: 13,
      color: theme.colors.gray600,
    },
  });
