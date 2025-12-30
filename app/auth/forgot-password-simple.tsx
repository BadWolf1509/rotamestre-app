import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import { Button, Card, Input, Text } from '@/design-system';
import { authService } from '@/lib/auth';
import { StyleSheet, type Theme } from '@/utils/styles';

export default function ForgotPassword() {
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
        [{ text: 'OK', onPress: () => router.back() }]
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
        <Text variant="subtitle" tone="error" style={styles.errorTitle}>
          Erro ao carregar tela
        </Text>
        <Text tone="error" style={styles.errorMessage}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.cardContainer}>
        <Card padding="large" style={styles.card} testID="auth-forgot-simple-card">
          <Text variant="title" style={styles.title}>
            Recuperar Senha
          </Text>

          <Text tone="muted" style={styles.description}>
            Digite seu e-mail e enviaremos instrucoes para redefinir sua senha.
          </Text>

          <Input
            label="E-mail"
            required
            placeholder="Digite seu e-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Button
            title="Enviar"
            onPress={handleResetPassword}
            loading={loading}
            disabled={loading}
            fullWidth
          />

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text tone="primary" style={styles.backLinkText}>
              Voltar para login
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
  cardContainer: {
    width: '100%',
  },
  card: {
    backgroundColor: theme.colors.white,
  },
  title: {
    marginBottom: 12,
  },
  description: {
    marginBottom: 24,
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: theme.typography.sm,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.errorBg,
  },
  errorTitle: {
    marginBottom: 8,
  },
  errorMessage: {
    textAlign: 'center',
  },
}));
