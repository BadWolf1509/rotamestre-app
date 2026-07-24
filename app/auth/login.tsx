import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { FieldError } from '@/components/auth/FieldError';
import { Dialog } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorMapping';
import { loginRateLimiter } from '@/lib/rateLimiter';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Inject focus ring styles for login inputs (web only)
// Colors must match defaultTheme.colors.primary (#284093)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'login-focus-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      [data-testid="auth-login-email"]:focus,
      [data-testid="auth-login-password"]:focus {
        border-color: #284093 !important;
        box-shadow: 0 0 0 3px rgba(40, 64, 147, 0.15) !important;
        outline: none !important;
      }
      [data-testid="auth-login-submit"]:hover {
        opacity: 0.9 !important;
        transform: translateY(-1px);
        transition: opacity 0.15s ease, transform 0.15s ease !important;
      }
      [data-testid="auth-login-submit"]:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export default function Login() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

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

  function showAlert(
    title: string,
    message: string,
    type: 'default' | 'error' | 'success' | 'warning' = 'error',
  ) {
    setAlertConfig({ visible: true, title, message, type });
  }

  function hideAlert() {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }

  async function onSubmit(data: LoginInput) {
    const { email, password } = data;

    // Verificar rate limit (proteção contra brute force)
    const rateLimitCheck = await loginRateLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      showAlert(
        'Muitas tentativas',
        rateLimitCheck.message || 'Aguarde antes de tentar novamente.',
        'warning',
      );
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
        await loginRateLimiter.recordAttempt(email, true);

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
        // A senha foi aceita, mas o perfil da aplicação não foi encontrado.
        // Não penalizar o usuário como se tivesse informado credenciais inválidas.
        await loginRateLimiter.recordAttempt(email, true);
        showAlert(
          'Usuário não encontrado',
          'Não encontramos sua conta. Verifique seus dados e tente novamente.',
          'error',
        );
      }
    } catch (error: unknown) {
      // Usar error mapping para mensagem amigável (sem expor detalhes técnicos)
      const friendlyError = getErrorMessage(error);

      // O rate limiter protege contra força bruta. Falhas de rede, servidor ou
      // configuração não devem bloquear um usuário com credenciais corretas.
      if (friendlyError.code === 'AUTH_INVALID_CREDENTIALS') {
        await loginRateLimiter.recordAttempt(email.toLowerCase(), false);
      }

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
              <Text style={styles.subtitleDesktop}>
                Entre com suas credenciais para continuar
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={styles.inputDesktop}
                      placeholder="seu@email.com"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      testID="auth-login-email"
                    />
                  )}
                />
                <FieldError message={errors.email?.message} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <View style={styles.passwordContainer}>
                  <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={styles.inputDesktopPassword}
                        placeholder="••••••••"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                        testID="auth-login-password"
                      />
                    )}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={
                      showPassword ? 'Ocultar senha' : 'Mostrar senha'
                    }
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={theme.colors.gray500}
                    />
                  </TouchableOpacity>
                </View>
                <FieldError message={errors.password?.message} />
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/auth/forgot-password')}
                testID="auth-login-forgot"
                accessibilityLabel="Esqueceu a senha?"
                accessibilityRole="link"
              >
                <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonDesktop}
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
                testID="auth-login-submit"
                accessibilityLabel="Entrar"
                accessibilityRole="button"
                accessibilityState={{ disabled: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Ainda não tem conta?</Text>
                <TouchableOpacity
                  onPress={() => router.push('/auth/register')}
                  accessibilityLabel="Solicitar acesso"
                  accessibilityRole="link"
                  style={styles.footerLink}
                >
                  <Text style={styles.footerLinkText}>Solicitar acesso</Text>
                </TouchableOpacity>
              </View>
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(20, insets.bottom + 20) },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        testID="auth-login-view"
      >
        <View style={styles.header}>
          <View style={styles.logoHorizontal}>
            <Image
              source={LogoHorizontal}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="RotaMestre logo"
              accessible={true}
            />
          </View>
          <Text style={styles.titleMobile}>Bem-vindo de volta!</Text>
          <Text style={styles.subtitle}>Entre com sua conta</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  testID="auth-login-email"
                />
              )}
            />
            <FieldError message={errors.email?.message} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.passwordContainer}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.inputPassword}
                    placeholder="••••••••"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    testID="auth-login-password"
                  />
                )}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={
                  showPassword ? 'Ocultar senha' : 'Mostrar senha'
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
            <FieldError message={errors.password?.message} />
          </View>

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => router.push('/auth/forgot-password')}
            testID="auth-login-forgot"
            accessibilityLabel="Esqueceu a senha?"
            accessibilityRole="link"
          >
            <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            testID="auth-login-submit"
            accessibilityLabel="Entrar"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não tem conta?</Text>
            <TouchableOpacity
              onPress={() => router.push('/auth/register')}
              accessibilityLabel="Solicitar acesso"
              accessibilityRole="link"
              style={styles.footerLink}
            >
              <Text style={styles.footerLinkText}>Solicitar acesso</Text>
            </TouchableOpacity>
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
      </ScrollView>
    </KeyboardAvoidingView>
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
    width: '50%',
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
  },
  rightPanel: {
    width: '50%',
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['16'],
    overflow: 'hidden',
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
    color: theme.colors.gray600,
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
    paddingRight: 50,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    // Android (RN 0.85/Fabric): sem color explícito o secureTextEntry renderiza
    // os bullets (•) numa cor invisível. Ver facebook/react-native#30123.
    color: theme.colors.gray900,
    backgroundColor: theme.colors.white,
  },
  eyeButton: {
    position: 'absolute',
    right: theme.spacing.sm,
    padding: theme.spacing.md,
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
    flexGrow: 1,
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
    color: theme.colors.gray600,
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
    paddingRight: 50,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    // Android (RN 0.85/Fabric): sem color explícito o secureTextEntry renderiza
    // os bullets (•) numa cor invisível. Ver facebook/react-native#30123.
    color: theme.colors.gray900,
    backgroundColor: theme.colors.white,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing['2.5'],
    ...theme.shadows.md,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.md,
  },
  forgotButtonText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSansMedium,
  },
  titleMobile: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xl,
  },
  footerText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray600,
  },
  footerLink: {
    paddingVertical: theme.spacing.sm,
  },
  footerLinkText: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
  },
}));
