import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { useSessionRecovery } from '@/hooks/auth/useSessionRecovery';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import {
  isAuthSessionMissingError,
  trySessionRecoveryFromUrl,
} from '@/lib/auth/sessionRecovery';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas';
import { styles } from '@/styles/auth/reset-password.styles';
import { useUnistyles } from '@/utils/styles';

export default function ResetPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, AlertDialog } = useAlert();
  const { checkingSession, linkExpired, setLinkExpired } = useSessionRecovery();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const confirmPasswordRef = useRef<TextInput>(null);
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const passwordValue = watch('password');

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  async function onPasswordUpdated() {
    // Redefinir via email também conclui a troca de senha inicial — sem isso
    // o onboarding de primeira_senha exigiria nova troca logo após o reset.
    await authService.marcarPrimeiraSenhaConcluida();
    showSuccess(
      'Senha atualizada!',
      'Sua senha foi redefinida com sucesso.',
      () => router.replace('/'),
    );
  }

  async function onSubmit(data: ResetPasswordInput) {
    const { password } = data;

    setLoading(true);

    try {
      await authService.updatePassword(password);
      await onPasswordUpdated();
    } catch (error: unknown) {
      if (!isAuthSessionMissingError(error)) {
        showError(error);
        return;
      }

      // Session may not be ready yet (URL callback race). Try one recovery + retry.
      const recovered = await trySessionRecoveryFromUrl();
      if (!recovered) {
        setLinkExpired(true);
        return;
      }

      try {
        await authService.updatePassword(password);
        await onPasswordUpdated();
      } catch (retryError: unknown) {
        if (isAuthSessionMissingError(retryError)) {
          // No valid session even after recovery — link likely expired/already used.
          setLinkExpired(true);
        } else {
          showError(retryError);
        }
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
      <Text style={styles.requirementText}>
        • Pelo menos 1 caractere especial (!@#$%&*)
      </Text>
    </View>
  );

  // ============================================
  // RENDER: Expired Link (shared content)
  // ============================================
  const expiredContent = (
    <View style={styles.expiredContainer}>
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={theme.colors.gray400}
      />
      <Text style={isDesktop ? styles.titleDesktop : styles.expiredTitle}>
        Link expirado
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.expiredMessage}>
        O link de recuperação de senha expirou ou já foi utilizado. Solicite um
        novo link para redefinir sua senha.
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
                <Text style={styles.subtitleDesktop}>
                  Verificando link de recuperação...
                </Text>
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
          <Text style={styles.checkingText}>
            Verificando link de recuperação...
          </Text>
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
            {linkExpired ? (
              expiredContent
            ) : (
              <>
                <View style={styles.headerDesktop}>
                  <Text style={styles.titleDesktop}>Nova Senha</Text>
                  <Text style={styles.subtitleDesktop}>
                    Digite sua nova senha abaixo. Confira os requisitos de
                    segurança.
                  </Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Nova Senha</Text>
                    <View style={styles.passwordContainer}>
                      <Controller
                        control={control}
                        name="password"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            style={styles.inputDesktopPassword}
                            placeholder="Digite sua nova senha"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
                            accessibilityLabel="Nova senha"
                            returnKeyType="next"
                            onSubmitEditing={() =>
                              confirmPasswordRef.current?.focus()
                            }
                            testID="auth-reset-password-new"
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
                          name={
                            showPassword ? 'eye-off-outline' : 'eye-outline'
                          }
                          size={22}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    </View>
                    <FieldError message={errors.password?.message} />
                    <PasswordStrengthIndicator password={passwordValue} />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirmar Senha</Text>
                    <View style={styles.passwordContainer}>
                      <Controller
                        control={control}
                        name="confirmPassword"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            ref={confirmPasswordRef}
                            style={styles.inputDesktopPassword}
                            placeholder="Digite novamente sua senha"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                            autoComplete="new-password"
                            accessibilityLabel="Confirmar senha"
                            returnKeyType="done"
                            onSubmitEditing={handleSubmit(onSubmit)}
                            testID="auth-reset-password-confirm"
                          />
                        )}
                      />
                      <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        accessibilityLabel={
                          showConfirmPassword
                            ? 'Ocultar confirmação de senha'
                            : 'Mostrar confirmação de senha'
                        }
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={
                            showConfirmPassword
                              ? 'eye-off-outline'
                              : 'eye-outline'
                          }
                          size={22}
                          color={theme.colors.gray500}
                        />
                      </TouchableOpacity>
                    </View>
                    <FieldError message={errors.confirmPassword?.message} />
                  </View>

                  {requirementsContent}

                  <TouchableOpacity
                    style={styles.buttonDesktop}
                    onPress={handleSubmit(onSubmit)}
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
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(20, insets.bottom + 20) },
        ]}
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

        {linkExpired ? (
          expiredContent
        ) : (
          <View style={styles.form}>
            <View style={styles.passwordContainer}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={styles.inputPassword}
                    placeholder="Nova senha"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    accessibilityLabel="Nova senha"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                    testID="auth-reset-password-new"
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
            <PasswordStrengthIndicator password={passwordValue} />

            <View style={styles.passwordContainer}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    ref={confirmPasswordRef}
                    style={styles.inputPassword}
                    placeholder="Confirmar senha"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    accessibilityLabel="Confirmar senha"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    testID="auth-reset-password-confirm"
                  />
                )}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                accessibilityLabel={
                  showConfirmPassword
                    ? 'Ocultar confirmação de senha'
                    : 'Mostrar confirmação de senha'
                }
                accessibilityRole="button"
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
            <FieldError message={errors.confirmPassword?.message} />

            {requirementsContent}

            <TouchableOpacity
              style={styles.button}
              onPress={handleSubmit(onSubmit)}
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
