import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { passwordResetRateLimiter } from '@/lib/rateLimiter';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  async function handleResetPassword() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      showWarning('Erro', 'Digite seu e-mail');
      return;
    }

    // Verificar rate limit local ANTES de chamar o Supabase
    const rateLimitCheck = await passwordResetRateLimiter.checkLimit(trimmedEmail);
    if (!rateLimitCheck.allowed) {
      showWarning('Aguarde', rateLimitCheck.message || 'Muitas tentativas. Tente novamente mais tarde.');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(trimmedEmail);

      // Registrar tentativa bem-sucedida (reseta o contador)
      await passwordResetRateLimiter.recordAttempt(trimmedEmail, true);

      showSuccess(
        'Email enviado!',
        'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
        () => router.push('/auth/login')
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        // 429 do Supabase = email já foi enviado recentemente
        // NÃO registrar como falha no rate limiter local (não é erro do usuário)
        showSuccess(
          'Email já enviado!',
          'Um email de recuperação já foi enviado recentemente. Verifique sua caixa de entrada e pasta de spam.',
          () => router.push('/auth/login')
        );
      } else if (errorMessage.includes('not found') || errorMessage.includes('invalid')) {
        // Não revelar se email existe ou não (segurança)
        showSuccess(
          'Email enviado!',
          'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.',
          () => router.push('/auth/login')
        );
      } else {
        // Registrar apenas erros reais como falha
        await passwordResetRateLimiter.recordAttempt(trimmedEmail, false);

        showError({
          title: 'Erro',
          message: 'Não foi possível enviar o email. Tente novamente mais tarde.'
        });
      }
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
          {AlertDialog}
          <View style={styles.formContainerDesktop}>
            <View style={styles.headerDesktop}>
              <Text style={styles.titleDesktop}>Recuperar Senha</Text>
              <Text style={styles.subtitleDesktop}>
                Digite seu e-mail e enviaremos instruções para redefinir sua senha
              </Text>
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
                />
              </View>

              <TouchableOpacity
                style={styles.buttonDesktop}
                onPress={handleResetPassword}
                disabled={loading}
                accessibilityLabel="Enviar link de recuperação"
                accessibilityRole="button"
                accessibilityState={{ disabled: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Enviar Link de Recuperação</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push('/auth/login')}
                accessibilityLabel="Voltar para login"
                accessibilityRole="link"
              >
                <Text style={styles.backButtonText}>Voltar para login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {AlertDialog}
        <View style={styles.header}>
          <View style={styles.logoHorizontal}>
            <Image
              source={LogoHorizontal}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.subtitle}>Recuperar senha</Text>
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
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleResetPassword}
            disabled={loading}
            accessibilityLabel="Enviar link de recuperação"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.buttonText}>Enviar Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/auth/login')}
            accessibilityLabel="Voltar para login"
            accessibilityRole="link"
          >
            <Text style={styles.backButtonText}>Voltar para login</Text>
          </TouchableOpacity>
        </View>
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
