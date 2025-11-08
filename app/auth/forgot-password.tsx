import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useRouter } from 'expo-router';
import { authService } from '@/lib/auth';
import { useResponsive } from '@/hooks/useResponsive';

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

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
          <View style={[styles.imageWrapper, { backgroundColor: '#004E89' }]}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#FF6B35', marginBottom: 20 }}>
                Rota Mestre
              </Text>
              <Text style={{ fontSize: 20, color: 'white', textAlign: 'center' }}>
                Otimização inteligente de rotas
              </Text>
            </View>
          </View>
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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Enviar Link de Recuperação</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>← Voltar para login</Text>
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
            source={require('../../assets/logo-horizontal1.png')}
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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Enviar Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Voltar para login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  // ============================================
  // DESKTOP STYLES
  // ============================================
  containerDesktop: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    backgroundColor: '#004E89',
  },
  imageWrapper: {
    flex: 1,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 10,
  },
  subtitleDesktop: {
    fontSize: 16,
    color: theme.colors.gray500,
    lineHeight: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.gray700,
    marginBottom: 8,
  },
  inputDesktop: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.secondary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },

  // ============================================
  // MOBILE STYLES
  // ============================================
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
    width: 250,
    height: 60,
  },
  subtitle: {
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
    marginBottom: 16,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  button: {
    backgroundColor: theme.colors.secondary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    padding: 12,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
}));
