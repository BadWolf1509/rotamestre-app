import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
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
import { Dialog } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorMapping';
import { loginRateLimiter } from '@/lib/rateLimiter';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function Login() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'default' | 'error' | 'success' | 'warning';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  function showAlert(title: string, message: string, type: 'default' | 'error' | 'success' | 'warning' = 'error') {
    setAlertConfig({ visible: true, title, message, type });
  }

  function hideAlert() {
    setAlertConfig({ ...alertConfig, visible: false });
  }

  async function handleLogin() {
    if (!email || !password) {
      showAlert('Ops!', 'Por favor, preencha seu e-mail e senha para continuar.', 'warning');
      return;
    }

    // Verificar rate limit (proteção contra brute force)
    const rateLimitCheck = await loginRateLimiter.checkLimit(email.toLowerCase());
    if (!rateLimitCheck.allowed) {
      showAlert('Muitas tentativas', rateLimitCheck.message || 'Aguarde antes de tentar novamente.', 'warning');
      return;
    }

    // Mostrar aviso se poucas tentativas restantes
    if (rateLimitCheck.message && rateLimitCheck.remainingAttempts <= 2) {
      // Não bloqueia, apenas avisa
    }

    setLoading(true);

    try {
      const { usuario } = await authService.signIn(email, password);

      if (usuario) {
        // Login bem-sucedido: resetar rate limit
        await loginRateLimiter.recordAttempt(email.toLowerCase(), true);

        // Verificar se é primeiro acesso e precisa trocar senha
        if (usuario.primeira_senha === true) {
          router.replace('/onboarding/first-password');
          return;
        }

        // Redirecionar para dashboard apropriado
        if (usuario.papel === 'gestor') {
          router.replace('/gestor/inicio');
        } else if (usuario.papel === 'motorista') {
          router.replace('/motorista');
        }
      } else {
        // Registrar tentativa falha
        await loginRateLimiter.recordAttempt(email.toLowerCase(), false);
        showAlert('Usuário não encontrado', 'Não encontramos sua conta. Verifique seus dados e tente novamente.', 'error');
      }
    } catch (error: unknown) {
      // Registrar tentativa falha
      await loginRateLimiter.recordAttempt(email.toLowerCase(), false);

      // Usar error mapping para mensagem amigável (sem expor detalhes técnicos)
      const friendlyError = getErrorMessage(error);
      showAlert(friendlyError.title, friendlyError.message, friendlyError.type);
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // RENDER: Desktop (Split Screen)
  // ============================================
  if (isDesktop) {
    return (
      <View style={styles.containerDesktop} testID="auth-login-view">
        {/* Left Side - Imagem de Branding (sem overlay de texto, imagem já contém tudo) */}
        <View style={styles.leftPanel}>
          <AuthBrandPanel />
        </View>

        {/* Right Side - Form (Branco) */}
        <View style={styles.rightPanel}>
          <View style={styles.formContainerDesktop}>
            <View style={styles.headerDesktop}>
              <Text style={styles.titleDesktop}>Bem-vindo de volta!</Text>
              <Text style={styles.subtitleDesktop}>Entre com suas credenciais para continuar</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <TextInput
                  style={styles.inputDesktop}
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="auth-login-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.inputDesktopPassword}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    testID="auth-login-password"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={theme.colors.gray500}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/auth/forgot-password')}
                testID="auth-login-forgot"
              >
                <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonDesktop}
                onPress={handleLogin}
                disabled={loading}
                testID="auth-login-submit"
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Alert Dialog */}
        <Dialog
          visible={alertConfig.visible}
          variant="alert"
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onConfirm={hideAlert}
        />
      </View>
    );
  }

  // ============================================
  // RENDER: Mobile/Tablet (Vertical Centered)
  // ============================================
  return (
    <View style={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 20) }]} testID="auth-login-view">
      <View style={styles.header}>
        <View style={styles.logoHorizontal}>
          <Image
            source={LogoHorizontal}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.subtitle}>Entre com sua conta</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="auth-login-email"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            testID="auth-login-password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.gray500}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => router.push('/auth/forgot-password')}
          testID="auth-login-forgot"
        >
          <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
          testID="auth-login-submit"
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Alert Dialog */}
      <Dialog
        visible={alertConfig.visible}
        variant="alert"
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={hideAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  containerDesktop: {
    flex: 1,
    flexDirection: 'row',
    ...(Platform.OS === 'web' && {
      height: '100vh' as any,
    }),
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
    maxWidth: 400,
  },
  headerDesktop: {
    marginBottom: theme.spacing['8'],
  },
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['3xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2'],
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
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
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  passwordContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputDesktopPassword: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    paddingRight: 45,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  eyeButton: {
    position: 'absolute',
    right: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
    ...theme.shadows.md,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logoHorizontal: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logoImage: {
    width: 280,
    height: 115,
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  form: {
    gap: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  inputPassword: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    paddingRight: 45,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing['2.5'],
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotButtonText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
