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
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { isPasswordValid } from '@/utils/passwordValidation';

export default function TrocarSenhaScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const [user, setUser] = useState<any>(null);
  const { profile, changePassword } = useProfile(user);

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
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      Alert.alert('Senha Fraca', 'A nova senha não atende aos requisitos mínimos de segurança');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da senha atual');
      return;
    }

    try {
      setLoading(true);
      await changePassword(currentPassword, newPassword);

      Alert.alert(
        'Sucesso!',
        'Senha alterada com sucesso. Você será redirecionado para fazer login novamente.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/auth/login');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message);
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
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              style={styles.eyeButton}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmar Nova Senha</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Digite novamente sua nova senha"
            autoCapitalize="none"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <Text style={styles.errorText}>As senhas não coincidem</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
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
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
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
