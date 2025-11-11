import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { StyleSheet, useUnistyles } from '@/utils/styles';

interface PerfilDesktopLayoutProps {
  usuario: any;
  loading?: boolean;
  uploadingPhoto?: boolean;
  onSelectPhoto?: () => void;
  atividade?: {
    ultimoAcesso: string | null;
    dispositivosAtivos: number | null;
  };
  children?: React.ReactNode;
}

export function PerfilDesktopLayout({
  usuario,
  loading,
  uploadingPhoto,
  onSelectPhoto,
  atividade,
  children,
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
    const label = value === 1 ? '1 dispositivo' : `${value} dispositivos`;
    return label;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header com navegação */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Meu Perfil</Text>
          <Text style={styles.headerSubtitle}>
            Gerencie suas informações pessoais e configurações
          </Text>
        </View>

        <View style={styles.mainContent}>
          {/* Sidebar com informações do usuário */}
          <View style={styles.sidebar}>
            <View style={styles.profileCard}>
              <TouchableOpacity
                onPress={onSelectPhoto}
                disabled={uploadingPhoto}
                style={styles.avatarContainer}
              >
                {usuario?.foto_url ? (
                  <Image source={{ uri: usuario.foto_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {usuario?.nome?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                {uploadingPhoto ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <View style={styles.avatarBadge}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <Text style={styles.userName}>{usuario?.nome || 'Usuário'}</Text>
              <Text style={styles.userEmail}>{usuario?.email || ''}</Text>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {usuario?.papel === 'gestor' ? 'Gestor' : 'Motorista'}
                </Text>
              </View>

              {usuario?.unidades?.nome && (
                <View style={styles.unitInfo}>
                  <Ionicons name="business-outline" size={16} color={theme.colors.gray500} />
                  <Text style={styles.unitName}>{usuario.unidades.nome}</Text>
                </View>
              )}

              <View style={styles.divider} />

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/perfil/editar')}
                >
                  <Ionicons name="person-outline" size={20} color={theme.colors.gray600} />
                  <Text style={styles.quickActionText}>Editar Perfil</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.gray400} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push('/perfil/trocar-senha')}
                >
                  <Ionicons name="lock-closed-outline" size={20} color={theme.colors.gray600} />
                  <Text style={styles.quickActionText}>Alterar Senha</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.gray400} />
                </TouchableOpacity>

              </View>
            </View>
          </View>

          {/* Content Area */}
          <View style={styles.contentArea}>
            {children ? (
              children
            ) : (
              <View style={styles.infoCards}>
                {/* Card de Informações Pessoais */}
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person" size={20} color={theme.colors.primary} />
                    <Text style={styles.cardTitle}>Informações Pessoais</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Nome Completo</Text>
                      <Text style={styles.infoValue}>{usuario?.nome || 'Não informado'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Email</Text>
                      <Text style={styles.infoValue}>{usuario?.email || 'Não informado'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Telefone</Text>
                      <Text style={styles.infoValue}>{usuario?.telefone || 'Não informado'}</Text>
                    </View>
                  </View>
                </View>

                {/* Card de Segurança */}
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
                    <Text style={styles.cardTitle}>Segurança</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Última alteração de senha</Text>
                      <Text style={styles.infoValue}>Há 30 dias</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Autenticação em dois fatores</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.warning }]}>
                        Desativada
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Card de Atividade */}
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="time" size={20} color={theme.colors.blue500} />
                    <Text style={styles.cardTitle}>Atividade Recente</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Último acesso</Text>
                      <Text style={styles.infoValue}>{formatDateTime(atividade?.ultimoAcesso)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dispositivos ativos</Text>
                      <Text style={styles.infoValue}>{formatDevices(atividade?.dispositivosAtivos)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.gray500,
  },
  header: {
    backgroundColor: theme.colors.white,
    padding: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  mainContent: {
    flexDirection: 'row',
    padding: 32,
    gap: 32,
    maxWidth: 1440,
    marginHorizontal: 'auto',
    width: '100%',
  },
  sidebar: {
    width: 320,
  },
  profileCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
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
    backgroundColor: 'transparent',
    transition: 'background-color 0.2s',
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.gray700,
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
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.gray900,
  },
}));
