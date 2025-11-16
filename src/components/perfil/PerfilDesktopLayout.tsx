import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';

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
          <TouchableOpacity
            onPress={onSelectPhoto}
            disabled={uploadingPhoto}
            style={styles(theme).avatarContainer}
          >
            {usuario?.foto_url ? (
              <Image source={{ uri: usuario.foto_url }} style={styles(theme).avatar} />
            ) : (
              <View style={styles(theme).avatarPlaceholder}>
                <Text style={styles(theme).avatarPlaceholderText}>
                  {usuario?.nome?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {uploadingPhoto ? (
              <View style={styles(theme).avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles(theme).avatarBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

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
    avatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      marginBottom: 16,
      overflow: 'hidden',
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 60,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 48,
      color: theme.colors.white,
      fontWeight: 'bold',
    },
    avatarOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 60,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarBadge: {
      position: 'absolute',
      bottom: 5,
      right: 5,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      borderWidth: 3,
      borderColor: theme.colors.white,
      justifyContent: 'center',
      alignItems: 'center',
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
      color: theme.colors.blue600,
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
  });
