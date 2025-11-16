import { useRouter } from 'expo-router';
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

import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';
import { isPasswordValid } from '@/utils/passwordValidation';
import { StyleSheet } from '@/utils/styles';

export default function FirstPasswordScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [user, setUser] = useState<any>(null);
  const { profile } = useProfile(user);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, []);

  async function handleSetPassword() {
    // Validações
    if (!newPassword || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      Alert.alert(
        'Senha Fraca',
        'A senha não atende aos requisitos mínimos de segurança. Por favor, crie uma senha mais forte.'
      );
      return;
    }

    try {
      setLoading(true);

      // Verificar se há uma sessão ativa
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Erro', 'Sessão expirada. Por favor, faça login novamente.');
        await supabase.auth.signOut();
        router.replace('/auth/login');
        return;
      }

      // Verificar se o perfil está carregado
      if (!user || !profile) {
        Alert.alert('Erro', 'Não foi possível carregar os dados do usuário.');
        setLoading(false);
        return;
      }

      // Segurança: verificar se realmente está marcado como primeira_senha
      if (profile.primeira_senha !== true) {
        console.warn('⚠️ Usuário tentou acessar first-password sem estar marcado como primeira_senha');
        // Redirecionar para a área apropriada
        const targetRoute = profile.papel === 'gestor' ? '/gestor/inicio' : '/motorista/rota';
        router.replace(targetRoute);
        return;
      }

      // Atualizar senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        // Se o erro for de senha igual, significa que o usuário está tentando
        // usar a mesma senha temporária. Vamos orientá-lo.
        if (updateError.message.includes('should be different') ||
            updateError.message.includes('same')) {
          Alert.alert(
            'Senha Inválida',
            'A nova senha não pode ser igual à senha temporária que você recebeu. Por favor, escolha uma senha diferente.'
          );
          setLoading(false);
          return;
        }

        console.error('Erro ao atualizar senha:', updateError);
        throw new Error(updateError.message || 'Erro ao atualizar senha');
      }

      // Marcar primeira_senha como false
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', user.id);

      if (dbError) {
        console.error('Erro ao atualizar primeira_senha:', dbError);
        // Não falhar aqui, a senha já foi atualizada
      }

      // Determinar rota de destino baseado no papel
      const targetRoute = profile.papel === 'gestor'
        ? '/gestor/inicio'
        : '/motorista/rota';

      const papelNome = profile.papel === 'gestor' ? 'Gestor' : 'Motorista';

      Alert.alert(
        'Senha Definida com Sucesso!',
        `Bem-vindo ao Rota Mestre, ${profile.nome}! Você será redirecionado para sua área de ${papelNome}.`,
        [
          {
            text: 'Continuar',
            onPress: () => {
              router.replace(targetRoute);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Erro completo:', error);
      Alert.alert('Erro', error.message || 'Erro ao definir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.welcomeText}>Bem-vindo! 👋</Text>
          <Text style={styles.title}>Defina sua Senha</Text>
          <Text style={styles.subtitle}>
            Por segurança, você precisa criar uma nova senha antes de continuar.
            Esta senha será usada para acessar o aplicativo.
          </Text>
        </View>

        {/* Nova Senha */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nova Senha</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholder="Digite sua nova senha"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeButton}
            >
              <Text>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          <PasswordStrengthIndicator password={newPassword} />
        </View>

        {/* Confirmar Senha */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="Digite novamente sua nova senha"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeButton}
            >
              <Text>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          {confirmPassword && newPassword !== confirmPassword && (
            <Text style={styles.errorText}>As senhas não coincidem</Text>
          )}
        </View>

        {/* Requisitos */}
        <View style={styles.requirementsBox}>
          <Text style={styles.requirementsTitle}>Requisitos de Segurança:</Text>
          <Text style={styles.requirementText}>• Mínimo de 8 caracteres</Text>
          <Text style={styles.requirementText}>• Pelo menos 1 letra maiúscula</Text>
          <Text style={styles.requirementText}>• Pelo menos 1 letra minúscula</Text>
          <Text style={styles.requirementText}>• Pelo menos 1 número</Text>
          <Text style={styles.requirementText}>• Pelo menos 1 caractere especial (!@#$%&*)</Text>
        </View>

        {/* Botão */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Definir Senha e Continuar</Text>
          )}
        </TouchableOpacity>

        {/* Info adicional */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Dica: Use uma senha única que você não usa em outros sites.
          </Text>
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
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 24,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  contentDesktop: {
    maxWidth: 550,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  welcomeText: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 28,
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  title: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 20,
    color: theme.colors.gray700,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: 14,
    color: theme.colors.gray500,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 14,
    color: theme.colors.gray700,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    marginTop: 4,
  },
  requirementsBox: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  requirementsTitle: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 13,
    color: theme.colors.primaryDark,
    marginBottom: 8,
  },
  requirementText: {
    fontFamily: theme.typography.fontSans,
    fontSize: 12,
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  infoBox: {
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLight,
  },
  infoText: {
    fontFamily: theme.typography.fontSans,
    fontSize: 12,
    color: theme.colors.secondaryDark,
    lineHeight: 18,
  },
}));
