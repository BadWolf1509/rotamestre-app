import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';


import { AvatarEditable } from '@/components/AvatarEditable';
import { ThemeSettings } from '@/components/ThemeSettings';
import { Text } from '@/design-system';
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

        {/* Unified Theme Settings with preview and reset */}
        <View style={styles(theme).settingsWrapper}>
          <ThemeSettings showPreview={true} />
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
      gap: theme.spacing.xl,
      width: '100%',
    },
    sidebar: {
      width: 320,
    },
    profileCard: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.gray100,
      ...theme.shadows.sm,
    },
    userName: {
      fontSize: theme.typography.xl,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    userEmail: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
      marginBottom: theme.spacing.md,
    },
    roleBadge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.blue50,
      marginBottom: theme.spacing.md,
    },
    roleBadgeText: {
      fontSize: theme.typography.xs,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.blue500,
    },
    unitInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    unitName: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray600,
    },
    divider: {
      width: '100%',
      height: 1,
      backgroundColor: theme.colors.gray200,
      marginVertical: theme.spacing.lg,
    },
    quickActions: {
      width: '100%',
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.xs,
      gap: theme.spacing.md,
    },
    quickActionText: {
      flex: 1,
      fontSize: theme.typography.sm,
      color: theme.colors.gray700,
    },
    logoutAction: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.md,
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
      gap: theme.spacing.lg,
    },
    infoCard: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      ...theme.shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray100,
    },
    cardTitle: {
      fontSize: theme.typography.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray900,
    },
    cardContent: {
      gap: theme.spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    infoLabel: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
    },
    infoValue: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray900,
      textAlign: 'right',
    },
    settingsWrapper: {
      marginTop: theme.spacing.lg,
    },
  });
