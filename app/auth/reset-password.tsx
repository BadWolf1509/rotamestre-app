import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  function validatePassword() {
    if (!password.trim()) {
      showWarning('Erro', 'Digite sua nova senha');
      return false;
    }

    if (password.length < 8) {
      showWarning('Erro', 'A senha deve ter no mínimo 8 caracteres');
      return false;
    }

    if (password !== confirmPassword) {
      showWarning('Erro', 'As senhas não coincidem');
      return false;
    }

    return true;
  }

  async function handleUpdatePassword() {
    if (!validatePassword()) {
      return;
    }

    setLoading(true);

    try {
      await authService.updatePassword(password);
      showSuccess(
        'Senha atualizada!',
        'Sua senha foi redefinida com sucesso. Faça login com sua nova senha.',
        () => router.replace('/auth/login')
      );
    } catch (error: unknown) {
      showError(error);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // RENDER: Desktop (Split Screen)
  // ============================================
  if (isDesktop) {
    return (
      <View style={styles.containerDesktop}>
        {/* Left Side - Branding */}
        <View style={styles.leftPanel}>
          <AuthBrandPanel />
        </View>

        {/* Right Side - Form */}
        <View style={styles.rightPanel}>
          <View style={styles.formContainerDesktop}>
            <View style={styles.headerDesktop}>
              <Text style={styles.titleDesktop}>Nova Senha</Text>
              <Text style={styles.subtitleDesktop}>
                Digite sua nova senha. Ela deve ter no mínimo 8 caracteres.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nova Senha</Text>
                <TextInput
                  style={styles.inputDesktop}
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirmar Senha</Text>
                <TextInput
                  style={styles.inputDesktop}
                  placeholder="Digite novamente sua senha"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.buttonDesktop}
                onPress={handleUpdatePassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Redefinir Senha</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace('/auth/login')}
              >
                <Text style={styles.backButtonText}>Voltar para login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {AlertDialog}
      </View>
    );
  }

  // ============================================
  // RENDER: Mobile/Tablet
  // ============================================
  return (
    <View style={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 20) }]}>
      <View style={styles.header}>
        <View style={styles.logoHorizontal}>
          <Image
            source={LogoHorizontal}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.subtitle}>Nova senha</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.buttonText}>Redefinir Senha</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/auth/login')}
        >
        <Text style={styles.backButtonText}>Voltar para login</Text>
        </TouchableOpacity>
      </View>
      {AlertDialog}
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  containerDesktop: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['16'],
  },
  formContainerDesktop: {
    width: '100%',
    maxWidth: 480,
  },
  headerDesktop: {
    marginBottom: theme.spacing['10'],
  },
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['3xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2.5'],
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    lineHeight: theme.spacing.xxl,
  },
  inputGroup: {
    marginBottom: theme.spacing.xxl,
  },
  inputLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    marginBottom: theme.spacing['2'],
  },
  inputDesktop: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing['3.5'],
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing['2'],
    ...theme.shadows.md,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing['10'],
  },
  logoHorizontal: {
    marginBottom: theme.spacing.xl,
  },
  logoImage: {
    width: 280,
    height: 115,
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  backButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
  },
}));

