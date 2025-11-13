import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authService } from '@/lib/auth';
import { StyleSheet, useUnistyles } from '@/utils/styles';

export default function ForgotPassword() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('ForgotPassword mounted');
    } catch (err) {
      console.error('Mount error:', err);
      setError(String(err));
    }
  }, []);

  async function handleResetPassword() {
    if (!email) {
      Alert.alert('Erro', 'Digite seu e-mail');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(email.trim());
      Alert.alert(
        'Sucesso',
        'Instrucoes de recuperacao foram enviadas para seu e-mail',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (resetError: any) {
      Alert.alert('Erro', resetError.message || 'Erro ao recuperar senha');
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <View style={styles.errorState}>
        <Text style={styles.errorTitle}>Erro ao carregar tela</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar Senha</Text>

        <Text style={styles.description}>
          Digite seu e-mail e enviaremos instrucoes para redefinir sua senha.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.buttonText}>Enviar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.back()}
        >
          <Text style={styles.backLinkText}>Voltar para login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create(theme => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 100,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    ...theme.shadows.md,
  },
  title: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 24,
    color: theme.colors.gray900,
    marginBottom: 12,
  },
  description: {
    fontFamily: theme.typography.fontSans,
    fontSize: 14,
    color: theme.colors.gray600,
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: 15,
    fontSize: 16,
    fontFamily: theme.typography.fontSans,
    marginBottom: 20,
    backgroundColor: theme.colors.white,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: 16,
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontFamily: theme.typography.fontSansMedium,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.errorBg,
  },
  errorTitle: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: 18,
    color: theme.colors.error,
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: theme.typography.fontSans,
    fontSize: 14,
    color: theme.colors.error,
    textAlign: 'center',
  },
}));
