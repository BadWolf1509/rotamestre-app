import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { useResponsive } from '@/hooks/useResponsive';
import { getConfirmationUrl } from '@/lib/auth/confirmationLink';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/**
 * Página intermediária que protege links de email contra scanners corporativos.
 *
 * O link do email aponta para cá com a URL real do Supabase no fragmento
 * (`#url=…`), que nunca chega ao servidor. O usuário clica um botão e só então
 * o OTP single-use é consumido. Ver `src/lib/auth/confirmationLink.ts`.
 *
 * Compartilhada por `app/auth/confirm-reset.tsx` e
 * `app/auth/confirm-signup.tsx` — o que muda entre as duas é apenas o texto e
 * as ações de fallback.
 */

export type AcaoFallback = {
  label: string;
  accessibilityLabel: string;
  destino: Href;
};

export type ConfirmLinkScreenProps = {
  /** Estado com link válido: o usuário pode prosseguir. */
  valido: {
    titulo: string;
    mensagem: string;
    labelBotao: string;
    accessibilityLabelBotao: string;
  };
  /** Estado sem link válido: expirado, já usado, ou destino não autorizado. */
  invalido: {
    titulo: string;
    mensagem: string;
    /** A primeira ação vira botão primário; as demais viram links de texto. */
    acoes: AcaoFallback[];
  };
};

export function ConfirmLinkScreen({
  valido,
  invalido,
}: ConfirmLinkScreenProps) {
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
        {valido.titulo}
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.message}>
        {valido.mensagem}
      </Text>
      <TouchableOpacity
        style={isDesktop ? styles.buttonDesktop : styles.button}
        onPress={handleContinue}
        disabled={redirecting}
        accessibilityLabel={valido.accessibilityLabelBotao}
        accessibilityRole="button"
        accessibilityState={{ disabled: redirecting }}
      >
        {redirecting ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.buttonText}>{valido.labelBotao}</Text>
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
        {invalido.titulo}
      </Text>
      <Text style={isDesktop ? styles.subtitleDesktop : styles.message}>
        {invalido.mensagem}
      </Text>
      {invalido.acoes.map((acao, indice) =>
        indice === 0 ? (
          <TouchableOpacity
            key={acao.label}
            style={isDesktop ? styles.buttonDesktop : styles.button}
            onPress={() => router.replace(acao.destino)}
            accessibilityLabel={acao.accessibilityLabel}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{acao.label}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            key={acao.label}
            style={styles.backButton}
            onPress={() => router.replace(acao.destino)}
            accessibilityLabel={acao.accessibilityLabel}
            accessibilityRole="link"
          >
            <Text style={styles.backButtonText}>{acao.label}</Text>
          </TouchableOpacity>
        ),
      )}
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
