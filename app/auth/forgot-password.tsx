import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/lib/auth';
import { useResponsive } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validação de email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError('');
    setSuccess(false);
  };

  async function handleResetPassword() {
    // Validações
    if (!email.trim()) {
      setEmailError('Digite seu e-mail');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Digite um e-mail válido');
      return;
    }

    setLoading(true);
    setEmailError('');

    try {
      await authService.resetPassword(email);
      setSuccess(true);

      Alert.alert(
        'E-mail enviado com sucesso!',
        'Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.',
        [{
          text: 'OK',
          onPress: () => router.back()
        }]
      );
    } catch (error: any) {
      setEmailError(error.message || 'Erro ao enviar e-mail de recuperação');
      Alert.alert('Erro', error.message || 'Erro ao recuperar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {/* Header com ícone */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={48} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>Recuperar Senha</Text>
            <Text style={styles.subtitle}>
              Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha
            </Text>
          </View>

          {/* Input de e-mail com ícone */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconContainer}>
              <Ionicons name="mail" size={20} color={theme.colors.gray400} />
            </View>
            <TextInput
              style={[
                styles.input,
                emailError && styles.inputError,
                success && styles.inputSuccess
              ]}
              placeholder="seu@email.com"
              placeholderTextColor={theme.colors.gray400}
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            {success && (
              <View style={styles.inputIconRight}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              </View>
            )}
          </View>

          {/* Mensagem de erro */}
          {emailError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={styles.errorText}>{emailError}</Text>
            </View>
          )}

          {/* Botão de enviar */}
          <TouchableOpacity
            style={[
              styles.button,
              (loading || !email) && styles.buttonDisabled
            ]}
            onPress={handleResetPassword}
            disabled={loading || !email}
          >
            {loading ? (
              <View style={styles.buttonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.buttonText}>Enviando...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Enviar link de recuperação</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Link de voltar */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={18} color={theme.colors.primary} />
            <Text style={styles.backLinkText}>Voltar para o login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 32,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  contentDesktop: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  inputIconContainer: {
    position: 'absolute',
    left: 16,
    top: 18,
    zIndex: 1,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    borderRadius: 12,
    paddingLeft: 48,
    paddingRight: 48,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBg,
  },
  inputSuccess: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.successBg,
  },
  inputIconRight: {
    position: 'absolute',
    right: 16,
    top: 18,
    zIndex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.errorBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    flex: 1,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  backLink: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  backLinkText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
}));
