import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { validatePassword } from '@/lib/schemas/basic';
import { isRecoveryRedirect, supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/** Parse error params from URL hash (Supabase redirects with #error=...&error_code=...) */
function getHashErrorParams(): { error?: string; errorCode?: string; errorDescription?: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return {};
  const hash = window.location.hash.substring(1);
  if (!hash) return {};
  const params = new URLSearchParams(hash);
  return {
    error: params.get('error') || undefined,
    errorCode: params.get('error_code') || undefined,
    errorDescription: params.get('error_description') || undefined,
  };
}

/** Try to manually establish session from URL hash tokens (fallback for SDK race condition) */
async function tryManualSessionRecovery(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.substring(1);
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');

  if (!access_token || !refresh_token) return false;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Check for error params from Supabase redirect (e.g. expired OTP, access denied)
  // Also proactively verify session when arriving from a recovery redirect
  //
  // IMPORTANT: Use onAuthStateChange (not getSession) to detect the session.
  // getSession() can return null due to a race condition in auth-js where the
  // SDK hasn't finished processing the URL hash tokens yet.
  // Ref: https://github.com/orgs/supabase/discussions/19608
  useEffect(() => {
    const { error, errorCode } = getHashErrorParams();
    if (errorCode === 'otp_expired' || error === 'access_denied') {
      setLinkExpired(true);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return;
    }

    if (!isRecoveryRedirect || Platform.OS !== 'web') return;

    setCheckingSession(true);
    let resolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (resolved) return;

        if (event === 'PASSWORD_RECOVERY') {
          // SDK processed recovery link and established session
          resolved = true;
          setCheckingSession(false);
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          // Session available (SDK already processed the URL hash)
          resolved = true;
          setCheckingSession(false);
          return;
        }

        if (event === 'INITIAL_SESSION' && !session) {
          // SDK initialized but no session — try manual recovery from URL hash
          // This handles the race condition where _getSessionFromURL didn't complete
          logger.debug('[ResetPassword] INITIAL_SESSION without session, trying manual recovery');
          const recovered = await tryManualSessionRecovery();
          resolved = true;
          if (!recovered) {
            setLinkExpired(true);
          }
          setCheckingSession(false);
        }
      }
    );

    // Safety timeout: if no auth event establishes a session within 10s, give up
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setLinkExpired(true);
        setCheckingSession(false);
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  function validateForm() {
    if (!password.trim()) {
      showWarning('Erro', 'Digite sua nova senha');
      return false;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      showWarning('Senha fraca', `A senha precisa:\n• ${passwordValidation.errors.join('\n• ')}`);
      return false;
    }

    if (password !== confirmPassword) {
      showWarning('Erro', 'As senhas não coincidem');
      return false;
    }

    return true;
  }

  async function handleUpdatePassword() {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authService.updatePassword(password);
      showSuccess(
        'Senha atualizada!',
        'Sua senha foi redefinida com sucesso.',
        () => router.replace('/')
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const name = error instanceof Error ? error.name : '';
      if (message.includes('Auth session missing') || name.includes('AuthSessionMissing')) {
        // No valid session — link was likely expired or already used
        setLinkExpired(true);
      } else {
        showError(error);
      }
    } finally {
      setLoading(false);
    }
  }

  // Shared: password requirements box
  const requirementsContent = (
    <View style={styles.requirementsBox}>
      <Text style={styles.requirementsTitle}>Requisitos de segurança:</Text>
      <Text style={styles.requirementText}>• Mínimo de 8 caracteres</Text>
      <Text style={styles.requirementText}>• Pelo menos 1 letra maiúscula</Text>
      <Text style={styles.requirementText}>• Pelo menos 1 número</Text>
      <Text style={styles.requirementText}>• Pelo menos 1 caractere especial (!@#$%&*)</Text>
    </View>
  );

  // Shared: password mismatch inline feedback
  const mismatchContent = confirmPassword && password !== confirmPassword ? (
    <Text style={styles.mismatchText}>As senhas não coincidem</Text>
  ) : null;

  // ============================================
  // RENDER: Expired Link (shared content)
  // ============================================
  const expiredContent = (
    <View style={styles.expiredContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={theme.colors.gray400} />
      <Text style={isDesktop ? styles.titleDesktop : styles.expiredTitle}>
        Link expirado
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.expiredMessage}>
        O link de recuperação de senha expirou ou já foi utilizado. Solicite um novo link para
        redefinir sua senha.
      </Text>
      <TouchableOpacity
        style={isDesktop ? styles.buttonDesktop : styles.button}
        onPress={() => router.replace('/auth/forgot-password')}
        accessibilityLabel="Solicitar novo link de recuperação"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Solicitar Novo Link</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace('/auth/login')}
        accessibilityLabel="Voltar para login"
        accessibilityRole="link"
        testID="auth-reset-password-back"
      >
        <Text style={styles.backButtonText}>Voltar para login</Text>
      </TouchableOpacity>
    </View>
  );

  // ============================================
  // RENDER: Checking Session (loading state)
  // ============================================
  if (checkingSession) {
    if (isDesktop) {
      return (
        <View style={styles.containerDesktop} testID="auth-reset-password-view">
          <View style={styles.leftPanel}>
            <AuthBrandPanel />
          </View>
          <View style={styles.rightPanel}>
            <View style={styles.formContainerDesktop}>
              <View style={styles.checkingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.subtitleDesktop}>Verificando link de recuperação...</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container} testID="auth-reset-password-view">
        <View style={styles.checkingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.checkingText}>Verificando link de recuperação...</Text>
        </View>
      </View>
    );
  }

  // ============================================
  // RENDER: Desktop (Split Screen)
  // ============================================
  if (isDesktop) {
    return (
      <View style={styles.containerDesktop} testID="auth-reset-password-view">
        {/* Left Side - Branding */}
        <View style={styles.leftPanel}>
          <AuthBrandPanel />
        </View>

        {/* Right Side */}
        <View style={styles.rightPanel}>
          <View style={styles.formContainerDesktop}>
            {linkExpired ? expiredContent : (
              <>
                <View style={styles.headerDesktop}>
                  <Text style={styles.titleDesktop}>Nova Senha</Text>
                  <Text style={styles.subtitleDesktop}>
                    Digite sua nova senha abaixo. Confira os requisitos de segurança.
                  </Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nova Senha</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.inputDesktopPassword}
                        placeholder="Digite sua nova senha"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        accessibilityLabel="Nova senha"
                        returnKeyType="next"
                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                        testID="auth-reset-password-new"
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                        accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    </View>
                    <PasswordStrengthIndicator password={password} />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirmar Senha</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        ref={confirmPasswordRef}
                        style={styles.inputDesktopPassword}
                        placeholder="Digite novamente sua senha"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoComplete="new-password"
                        accessibilityLabel="Confirmar senha"
                        returnKeyType="done"
                        onSubmitEditing={handleUpdatePassword}
                        testID="auth-reset-password-confirm"
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        accessibilityLabel={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    </View>
                    {mismatchContent}
                  </View>

                  {requirementsContent}

                  <TouchableOpacity
                    style={styles.buttonDesktop}
                    onPress={handleUpdatePassword}
                    disabled={loading}
                    accessibilityLabel="Redefinir senha"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: loading }}
                    testID="auth-reset-password-submit"
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
                    accessibilityLabel="Voltar para login"
                    accessibilityRole="link"
                    testID="auth-reset-password-back"
                  >
                    <Text style={styles.backButtonText}>Voltar para login</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(20, insets.bottom + 20) }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        testID="auth-reset-password-view"
      >
        {!linkExpired && (
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
        )}

        {linkExpired ? expiredContent : (
          <View style={styles.form}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.inputPassword}
                placeholder="Nova senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                accessibilityLabel="Nova senha"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                testID="auth-reset-password-new"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
            <PasswordStrengthIndicator password={password} />

            <View style={styles.passwordContainer}>
              <TextInput
                ref={confirmPasswordRef}
                style={styles.inputPassword}
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                accessibilityLabel="Confirmar senha"
                returnKeyType="done"
                onSubmitEditing={handleUpdatePassword}
                testID="auth-reset-password-confirm"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                accessibilityLabel={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
            {mismatchContent}

            {requirementsContent}

            <TouchableOpacity
              style={styles.button}
              onPress={handleUpdatePassword}
              disabled={loading}
              accessibilityLabel="Redefinir senha"
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
              testID="auth-reset-password-submit"
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
              accessibilityLabel="Voltar para login"
              accessibilityRole="link"
              testID="auth-reset-password-back"
            >
              <Text style={styles.backButtonText}>Voltar para login</Text>
            </TouchableOpacity>
          </View>
        )}
        {AlertDialog}
      </ScrollView>
    </KeyboardAvoidingView>
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
    padding: theme.spacing['3.5'],
    paddingRight: 45,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
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
    marginTop: theme.spacing['2'],
    ...theme.shadows.md,
  },
  container: {
    flexGrow: 1,
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
    gap: theme.spacing.lg,
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
    color: theme.colors.gray900,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
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
  checkingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  checkingText: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
  },
  expiredContainer: {
    alignItems: 'center',
  },
  expiredTitle: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  expiredMessage: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    textAlign: 'center',
    lineHeight: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
  },
  mismatchText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  requirementsBox: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  requirementsTitle: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  requirementText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.xs,
  },
}));
