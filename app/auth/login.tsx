import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { AlertDialog } from '@/components/AlertDialog';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { StyleSheet, useUnistyles } from '@/utils/styles';

export default function Login() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  function showAlert(title: string, message: string, type: 'default' | 'error' | 'success' | 'warning' = 'error') {
    setAlertConfig({ visible: true, title, message, type });
  }

  function hideAlert() {
    setAlertConfig({ ...alertConfig, visible: false });
  }

  async function handleLogin() {
    if (!email || !password) {
      showAlert('Ops!', 'Por favor, preencha seu e-mail e senha para continuar.', 'warning');
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
          router.replace('/gestor/inicio');
        } else if (usuario.papel === 'motorista') {
          router.replace('/motorista/inicio');
        }
      } else {
        showAlert('Usuário não encontrado', 'Não encontramos sua conta. Verifique seus dados e tente novamente.', 'error');
      }
    } catch (error: any) {
      // Mensagens de erro mais amigáveis baseadas no tipo de erro
      let title = 'Não foi possível entrar';
      let message = 'Verifique seu e-mail e senha e tente novamente.';

      if (error.message?.toLowerCase().includes('invalid')) {
        title = 'E-mail ou senha incorretos';
        message = 'Verifique seus dados e tente novamente. Caso tenha esquecido sua senha, clique em "Esqueceu a senha?".';
      } else if (error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('connection')) {
        title = 'Sem conexão';
        message = 'Verifique sua conexão com a internet e tente novamente.';
      }

      showAlert(title, message, 'error');
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
          <AuthBrandPanel />
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
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.inputDesktopPassword}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={theme.colors.gray500}
                    />
                  </TouchableOpacity>
                </View>
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

        {/* Alert Dialog */}
        <AlertDialog
          visible={alertConfig.visible}
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

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.colors.gray500}
            />
          </TouchableOpacity>
        </View>

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

      {/* Alert Dialog */}
      <AlertDialog
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={hideAlert}
      />
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
    maxWidth: 400,
  },
  headerDesktop: {
    marginBottom: 32,
  },
  titleDesktop: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 32,
    color: theme.colors.gray900,
    marginBottom: 8,
  },
  subtitleDesktop: {
    fontFamily: theme.typography.fontSans,
    fontSize: 16,
    color: theme.colors.gray500,
  },
  inputGroup: {
    marginBottom: 16,
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
    padding: 12,
    fontSize: 16,
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
    borderRadius: 8,
    padding: 12,
    paddingRight: 45,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  buttonDesktop: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    ...theme.shadows.md,
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
    fontFamily: theme.typography.fontSans,
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
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  inputPassword: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: 8,
    padding: 15,
    paddingRight: 45,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    backgroundColor: theme.colors.white,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotButtonText: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontFamily: theme.typography.fontSansMedium,
  },
}));
