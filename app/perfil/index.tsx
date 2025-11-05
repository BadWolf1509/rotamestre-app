import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function PerfilScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const [user, setUser] = useState<any>(null);
  const { profile, loading: profileLoading, updateProfile } = useProfile(user);

  const [isEditing, setIsEditing] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);

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
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }

    try {
      setLoading(true);
      await updateProfile({
        nome: nome.trim(),
        telefone: telefone.trim() || null,
      });

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
      setIsEditing(false);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    // Restaurar valores originais
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setIsEditing(false);
  }

  async function handleLogout() {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
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
        <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ResponsiveContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Meu Perfil</Text>
            <Text style={styles.subtitle}>
              Gerencie suas informações pessoais
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
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>{profile.telefone || 'Não informado'}</Text>
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
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.buttonText}>Editar Perfil</Text>
          </TouchableOpacity>
        )}

        {/* Ações Adicionais */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/perfil/trocar-senha')}
          >
            <Text style={styles.actionButtonText}>🔒 Trocar Senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              🚪 Sair da Conta
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    maxWidth: '100%',
  },
  contentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    marginTop: -4,
  },
  backIcon: {
    fontSize: 24,
    color: theme.colors.primary,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.gray700,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    color: theme.colors.gray900,
  },
  valueSecondary: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.gray400,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.white,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.infoBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.info,
  },
  editButtons: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: theme.colors.secondary,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: theme.colors.success,
  },
  cancelButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: theme.colors.gray500,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.gray700,
  },
  logoutButton: {
    borderColor: theme.colors.errorBg,
    backgroundColor: theme.colors.errorBg,
  },
  logoutButtonText: {
    color: theme.colors.error,
  },
}));
