import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useResponsive } from '@/hooks/useResponsive';
import { supabaseUrl } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/**
 * Página intermediária para proteção contra link scanners de email corporativo.
 *
 * Link scanners fazem prefetch de URLs nos emails para verificar malware,
 * consumindo o OTP single-use do Supabase antes que o usuário clique.
 *
 * Solução: O link no email usa fragmento URL (#url=<ConfirmationURL>).
 * Fragmentos nunca são enviados ao servidor HTTP, logo scanners não veem o token.
 * O usuário clica um botão para seguir o link real do Supabase.
 *
 * A URL extraída é validada contra o host do projeto Supabase antes do
 * redirect — sem isso a página viraria um open redirect para phishing.
 *
 * Ref: https://github.com/supabase/supabase/discussions/41618
 */

/** Aceita apenas https com host idêntico ao do projeto Supabase (anti open-redirect) */
function isAllowedConfirmationUrl(url: string): boolean {
  if (!supabaseUrl) return false; // env ausente (E2E/CI): rejeita por segurança
  try {
    const target = new URL(url);
    const allowed = new URL(supabaseUrl);
    return target.protocol === 'https:' && target.host === allowed.host;
  } catch {
    return false;
  }
}

/** Extract the Supabase confirmation URL from the URL fragment */
function getConfirmationUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#url=')) return null;
  try {
    const decoded = decodeURIComponent(hash.substring(5));
    return isAllowedConfirmationUrl(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function ConfirmResetContent() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [redirecting, setRedirecting] = useState(false);

  const confirmationUrl = getConfirmationUrl();

  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  function handleContinue() {
    if (!confirmationUrl) return;
    setRedirecting(true);
    // External URL (Supabase domain) — must use window.location, not router
    window.location.href = confirmationUrl;
  }

  // ============================================
  // CONTENT: Valid URL — show continue button
  // ============================================
  const validContent = (
    <View style={styles.contentContainer}>
      <Ionicons
        name="shield-checkmark-outline"
        size={48}
        color={theme.colors.primary}
      />
      <Text style={isDesktop ? styles.titleDesktop : styles.title}>
        Recuperação de Senha
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.message}>
        Clique no botão abaixo para continuar com a redefinição da sua senha.
      </Text>
      <TouchableOpacity
        style={isDesktop ? styles.buttonDesktop : styles.button}
        onPress={handleContinue}
        disabled={redirecting}
        accessibilityLabel="Continuar para redefinir senha"
        accessibilityRole="button"
        accessibilityState={{ disabled: redirecting }}
      >
        {redirecting ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.buttonText}>Continuar</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ============================================
  // CONTENT: Invalid/missing URL — show error
  // ============================================
  const invalidContent = (
    <View style={styles.contentContainer}>
      <Ionicons
        name="alert-circle-outline"
        size={48}
        color={theme.colors.gray400}
      />
      <Text style={isDesktop ? styles.titleDesktop : styles.title}>
        Link inválido
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.message}>
        O link de recuperação de senha é inválido ou está incompleto. Solicite
        um novo link.
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
      >
        <Text style={styles.backButtonText}>Voltar para login</Text>
      </TouchableOpacity>
    </View>
  );

  const content = confirmationUrl ? validContent : invalidContent;

  // ============================================
  // RENDER: Desktop (Split Screen)
  // ============================================
  if (isDesktop) {
    return (
      <View style={styles.containerDesktop}>
        <View style={styles.leftPanel}>
          <AuthBrandPanel />
        </View>
        <View style={styles.rightPanel}>
          <View style={styles.formContainerDesktop}>{content}</View>
        </View>
      </View>
    );
  }

  // ============================================
  // RENDER: Mobile/Tablet
  // ============================================
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoHorizontal}>
          <Image
            source={LogoHorizontal}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </View>
      {content}
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
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['3xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2.5'],
    marginTop: theme.spacing.lg,
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    lineHeight: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
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
  contentContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontFamily: theme.typography.fontSans,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    textAlign: 'center',
    lineHeight: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    width: '100%',
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

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function ConfirmReset() {
  return (
    <ErrorBoundary>
      <ConfirmResetContent />
    </ErrorBoundary>
  );
}
