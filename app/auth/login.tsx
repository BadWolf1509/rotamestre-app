import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ImageBackground,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '@/lib/auth';
import { useResponsive } from '@/hooks/useResponsive';

export default function Login() {
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
          <Text style={styles.logoText}>Rota Mestre</Text>
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

const styles = StyleSheet.create({
  // ============================================
  // DESKTOP STYLES (Split Screen)
  // ============================================
  containerDesktop: {
    flex: 1,
    flexDirection: 'row',
    ...(Platform.OS === 'web' && {
      height: '100vh' as any,
    }),
  },
  leftPanel: {
    flex: 1,
    backgroundColor: '#0D5A9C', // Azul Dark - Brand Guidelines (fallback se imagem não carregar)
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
    // Alinha imagem no topo, cortando apenas a parte inferior
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web' && {
      objectPosition: 'top center' as any, // Mantém topo visível
    }),
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#fff',
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
    color: '#fff',
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
    color: '#111827', // Gray 900
    marginBottom: 8,
  },
  subtitleDesktop: {
    fontSize: 16,
    color: '#6b7280', // Gray 500
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151', // Gray 700
    marginBottom: 8,
  },
  inputDesktop: {
    borderWidth: 1,
    borderColor: '#d1d5db', // Gray 300
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  buttonDesktop: {
    backgroundColor: '#f7a02a', // Laranja - Brand Guidelines (CTA)
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },

  // ============================================
  // MOBILE/TABLET STYLES (Vertical Centered)
  // ============================================
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoHorizontal: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B35', // Laranja Brand
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280', // Gray 500
  },
  form: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#f7a02a', // Laranja - Brand Guidelines
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotButtonText: {
    color: '#1e5aa8', // Azul Main - Brand Guidelines
    fontSize: 14,
  },
});
