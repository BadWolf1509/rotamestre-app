import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import LogoHorizontalDark from '@/../assets/logo-horizontal.png';
import LogoHorizontalLight from '@/../assets/logo-horizontal1.png';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Detectar tema escuro para usar logo apropriada
  const isDarkMode = UnistylesRuntime.themeName?.startsWith('dark');
  const LogoHorizontal = isDarkMode ? LogoHorizontalDark : LogoHorizontalLight;

  async function handleResetPassword() {
    if (!email.trim()) {
      Alert.alert('Erro', 'Digite seu e-mail');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(email);
      Alert.alert(
        'Email enviado!',
        'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao enviar email de recuperação');
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
    <View style={styles.container}>
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
        >
          <Text style={styles.backButtonText}>Voltar para login</Text>
        </TouchableOpacity>
      </View>
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
    padding: 60,
  },
  formContainerDesktop: {
    width: '100%',
    maxWidth: 480,
  },
  headerDesktop: {
    marginBottom: 40,
  },
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 32,
    color: theme.colors.gray900,
    marginBottom: 10,
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: 16,
    color: theme.colors.gray500,
    lineHeight: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: theme.typography.fontSansSemiBold,
    fontSize: 14,
    color: theme.colors.gray700,
    marginBottom: 8,
  },
  inputDesktop: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    ...theme.shadows.md,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoHorizontal: {
    marginBottom: 20,
  },
  logoImage: {
    width: 280,
    height: 115, // Proporção 336:138 (2.43:1) ajustada para mobile
  },
  subtitle: {
    fontFamily: theme.typography.fontSans,
    fontSize: 18,
    color: theme.colors.gray600,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    marginBottom: 16,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
