import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { isPasswordValid } from '@/utils/passwordValidation';

export default function FirstPasswordScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const { profile, updateProfile } = useProfile(user);

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

      // Atualizar senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
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

      Alert.alert(
        'Sucesso!',
        'Sua senha foi definida com sucesso. Bem-vindo ao Rota Mestre!',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
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
    <ScrollView style={styles.container}>
      <View style={styles.content}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  requirementsBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#1e40af',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#f7a02a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  infoText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
});
