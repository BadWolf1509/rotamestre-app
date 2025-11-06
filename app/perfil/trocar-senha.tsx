import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { isPasswordValid } from '@/utils/passwordValidation';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

export default function TrocarSenhaScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const [user, setUser] = useState<any>(null);
  const { profile, changePassword } = useProfile(user);
  const { toast, showToast, hideToast, withToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, []);

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Preencha todos os campos', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('As senhas não coincidem', 'error');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      showToast('A nova senha não atende aos requisitos mínimos de segurança', 'error');
      return;
    }

    if (currentPassword === newPassword) {
      showToast('A nova senha deve ser diferente da senha atual', 'error');
      return;
    }

    try {
      setLoading(true);
      await withToast(
        async () => {
          await changePassword(currentPassword, newPassword);
          await supabase.auth.signOut();
          router.replace('/auth/login');
        },
        {
          loading: 'Alterando senha...',
          success: 'Senha alterada com sucesso! Faça login novamente.',
          error: 'Erro ao alterar senha',
        }
      );
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Trocar Senha</Text>
            <Text style={styles.headerSubtitle}>
              {profile?.unidades?.nome || 'Rota Mestre'}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Por segurança, você precisará fazer login novamente após trocar a senha.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha Atual</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              placeholder="Digite sua senha atual"
              autoCapitalize="none"
              accessibilityLabel="Campo de senha atual"
              accessibilityHint="Digite sua senha atual para confirmar a alteração"
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              style={styles.eyeButton}
              accessibilityLabel={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
              accessibilityRole="button"
            >
              <Text>{showCurrentPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

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
              accessibilityLabel="Campo de nova senha"
              accessibilityHint="Digite a nova senha que deseja usar"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeButton}
              accessibilityLabel={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
              accessibilityRole="button"
            >
              <Text>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>
          <PasswordStrengthIndicator password={newPassword} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Digite novamente sua nova senha"
            autoCapitalize="none"
            accessibilityLabel="Campo de confirmação de senha"
            accessibilityHint="Digite novamente a nova senha para confirmar"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <Text style={styles.errorText}>As senhas não coincidem</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
          accessibilityLabel="Alterar senha"
          accessibilityRole="button"
          accessibilityHint="Confirma a alteração da senha"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Alterar Senha</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
          accessibilityLabel="Cancelar alteração de senha"
          accessibilityRole="button"
          accessibilityHint="Cancela e volta para a tela anterior"
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Toast de Feedback */}
      <Toast {...toast} onDismiss={hideToast} />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
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
    maxWidth: 600,
    marginHorizontal: 'auto',
    width: '100%',
  },
  infoBox: {
    backgroundColor: theme.colors.info + '10',
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  infoText: {
    fontSize: theme.typography.sm,
    color: theme.colors.info,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: theme.spacing['2xl'],
  },
  label: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    backgroundColor: theme.colors.white,
  },
  eyeButton: {
    position: 'absolute',
    right: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.error,
    marginTop: 4,
  },
  button: {
    backgroundColor: theme.colors.secondary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  cancelButton: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.gray500,
    fontSize: theme.typography.base,
  },
}));
