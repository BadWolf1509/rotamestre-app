import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { formatPhone, validatePhone, getPhoneErrorMessage, maskPhone } from '@/utils/phoneValidation';

export default function PerfilScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const [user, setUser] = useState<any>(null);
  const { profile, loading: profileLoading, updateProfile, refetch } = useProfile(user);
  const { toast, showToast, hideToast, withToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setTelefone(profile.telefone || '');
    }
  }, [profile]);

  async function handleSave() {
    if (!nome.trim()) {
      showToast('Nome é obrigatório', 'error');
      return;
    }

    if (telefone && !validatePhone(telefone)) {
      showToast('Telefone inválido', 'error');
      return;
    }

    try {
      setLoading(true);
      await withToast(
        async () => {
          await updateProfile({
            nome: nome.trim(),
            telefone: telefone.trim() || null,
          });
        },
        {
          loading: 'Salvando alterações...',
          success: 'Perfil atualizado com sucesso!',
          error: 'Erro ao atualizar perfil',
        }
      );

      setIsEditing(false);
    } catch (error: any) {
      console.error('Erro ao salvar perfil:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setPhoneError('');
    setIsEditing(false);
  }

  function handlePhoneChange(text: string) {
    const formatted = maskPhone(text);
    setTelefone(formatted);

    if (text.length > 0) {
      const error = getPhoneErrorMessage(formatted);
      setPhoneError(error || '');
    } else {
      setPhoneError('');
    }
  }

  async function handleLogout() {
    if (Platform.OS === 'web') {
      setShowLogoutModal(true);
    } else {
      const Alert = require('react-native').Alert;
      Alert.alert(
        'Sair da Conta',
        'Tem certeza que deseja sair?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: confirmLogout,
          },
        ]
      );
    }
  }

  async function confirmLogout() {
    setShowLogoutModal(false);
    await withToast(
      async () => {
        await supabase.auth.signOut();
        router.replace('/auth/login');
      },
      {
        loading: 'Saindo...',
        success: 'Até logo!',
        error: 'Erro ao sair',
      }
    );
  }

  async function handleRetry() {
    if (refetch) {
      await refetch();
    }
  }

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f7a02a" />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Erro ao carregar perfil</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          accessibilityLabel="Tentar carregar perfil novamente"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Meu Perfil</Text>
            <Text style={styles.headerSubtitle}>
              {profile?.unidades?.nome || 'Rota Mestre'}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>

        {/* Profile Header com Avatar */}
        <View style={styles.profileHeader}>
          <Avatar
            name={profile.nome}
            imageUrl={profile.foto_url}
            size="xl"
          />
          <View style={styles.profileHeaderInfo}>
            <Text style={styles.profileName}>{profile.nome}</Text>
            <Text style={styles.profileRole}>
              {profile.papel === 'gestor' ? 'Gestor' : 'Motorista'}
            </Text>
          </View>
        </View>

        {/* Informações do Perfil */}
        <View style={styles.card}>
          <View style={styles.infoGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Digite seu nome completo"
                autoCapitalize="words"
                accessibilityLabel="Campo de nome completo"
                accessibilityHint="Digite seu nome completo"
              />
            ) : (
              <Text style={styles.value}>{profile.nome}</Text>
            )}
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.label}>E-mail</Text>
            <Text style={styles.value}>{profile.email}</Text>
            <Text style={styles.hint}>O e-mail não pode ser alterado</Text>
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.label}>Telefone</Text>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.input, phoneError && styles.inputError]}
                  value={telefone}
                  onChangeText={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  maxLength={15}
                  accessibilityLabel="Campo de telefone"
                  accessibilityHint="Digite seu telefone com DDD"
                />
                {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              </>
            ) : (
              <Text style={styles.value}>{formatPhone(profile.telefone) || 'Não informado'}</Text>
            )}
          </View>

          <View style={styles.infoGroup}>
            <Text style={styles.label}>Papel</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {profile.papel === 'gestor' ? 'Gestor' : 'Motorista'}
              </Text>
            </View>
          </View>

          {profile.ultimo_login && (
            <View style={styles.infoGroup}>
              <Text style={styles.label}>Último acesso</Text>
              <Text style={styles.valueSecondary}>
                {new Date(profile.ultimo_login).toLocaleString('pt-BR')}
              </Text>
            </View>
          )}
        </View>

        {/* Botões de Edição */}
        {isEditing ? (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
              accessibilityLabel="Salvar alterações do perfil"
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Salvar Alterações</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
              accessibilityLabel="Cancelar edição"
              accessibilityRole="button"
              accessibilityHint="Descarta as alterações feitas"
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setIsEditing(true)}
            accessibilityLabel="Editar perfil"
            accessibilityRole="button"
            accessibilityHint="Ativa o modo de edição do perfil"
          >
            <Text style={styles.buttonText}>✏️ Editar Perfil</Text>
          </TouchableOpacity>
        )}

        {/* Ações Adicionais */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/perfil/trocar-senha')}
            accessibilityLabel="Trocar senha"
            accessibilityRole="button"
            accessibilityHint="Navega para a tela de troca de senha"
          >
            <Text style={styles.actionButtonText}>🔒 Trocar Senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
            accessibilityLabel="Sair da conta"
            accessibilityRole="button"
            accessibilityHint="Desloga do sistema"
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              🚪 Sair da Conta
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>

      {/* Modal de Confirmação de Logout */}
      <ConfirmModal
        visible={showLogoutModal}
        title="Sair da Conta"
        message="Tem certeza que deseja sair? Você precisará fazer login novamente para acessar o sistema."
        confirmText="Sair"
        cancelText="Cancelar"
        type="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Toast de Feedback */}
      <Toast {...toast} onDismiss={hideToast} />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing['2xl'],
  },
  errorText: {
    fontSize: theme.typography.base,
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  infoGroup: {
    marginBottom: theme.spacing['2xl'],
  },
  label: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
  },
  valueSecondary: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  hint: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray400,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    backgroundColor: theme.colors.white,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.info + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  badgeText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.info,
  },
  editButtons: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  button: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: theme.colors.secondary,
    marginBottom: theme.spacing.lg,
  },
  saveButton: {
    backgroundColor: theme.colors.success,
  },
  cancelButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  cancelButtonText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  actions: {
    gap: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  actionButtonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  logoutButton: {
    borderColor: theme.colors.error + '30',
    backgroundColor: theme.colors.error + '10',
  },
  logoutButtonText: {
    color: theme.colors.error,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing['3xl'],
    padding: theme.spacing['2xl'],
    backgroundColor: theme.colors.primary + '08',
    borderRadius: theme.borderRadius.xl,
  },
  profileHeaderInfo: {
    marginLeft: theme.spacing['2xl'],
    flex: 1,
  },
  profileName: {
    fontSize: theme.typography['2xl'],
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  profileRole: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    marginTop: 4,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.error,
    marginTop: 4,
  },
}));
