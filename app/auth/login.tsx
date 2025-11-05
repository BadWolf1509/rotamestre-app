import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Platform,
  Image,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { authService } from '@/lib/auth';
import { useResponsive } from '@/hooks/useResponsive';

export default function Login() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop, isMobile, width, height, breakpoint } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);


  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const { usuario } = await authService.signIn(email, password);

      if (usuario) {
        // Verificar se é primeiro acesso e precisa trocar senha
        if (usuario.primeira_senha === true) {
          router.replace('/onboarding/first-password');
          return;
        }

        // Redirecionar para dashboard apropriado
        if (usuario.papel === 'gestor') {
          router.replace('/gestor/dashboard');
        } else if (usuario.papel === 'motorista') {
          router.replace('/motorista/rota');
        }
      } else {
        Alert.alert('Erro', 'Usuário não encontrado');
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao fazer login');
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
        {/* Left Side - Imagem de Branding (sem overlay de texto, imagem já contém tudo) */}
        <View style={styles.leftPanel}>
          <View style={[styles.imageWrapper, { backgroundColor: '#004E89' }]}>
            {/* Fallback: cor sólida para web/produção */}
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
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput
                  style={styles.inputDesktop}
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>

              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/auth/forgot-password')}
              >
                <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonDesktop}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ============================================
  // RENDER: Mobile/Tablet (Vertical Centered)
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
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => router.push('/auth/forgot-password')}
        >
          <Text style={styles.forgotButtonText}>Esqueceu a senha?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
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
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' && {
      objectPosition: 'top center' as any,
    }),
  },
  rightPanel: {
    flex: 1,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  brandingContainer: {
    maxWidth: 500,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  brandFeatures: {
    gap: 16,
    width: '100%',
  },
  brandFeature: {
    fontSize: 16,
    color: theme.colors.white,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  formContainerDesktop: {
    width: '100%',
    maxWidth: 400,
  },
  headerDesktop: {
    marginBottom: 32,
  },
  titleDesktop: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  subtitleDesktop: {
    fontSize: 16,
    color: theme.colors.gray500,
  },
  inputGroup: {
    marginBottom: 16,
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
    padding: 12,
    fontSize: 16,
    backgroundColor: theme.colors.white,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.secondary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoHorizontal: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 180,
    height: 180,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.gray500,
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.secondary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 14,
  },
}));
