import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Button, Card, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { signupRateLimiter } from '@/lib/rateLimiter';
import { validatePassword, PASSWORD_MIN_LENGTH, isValidEmail } from '@/lib/validation';
import { TipoUsuario } from '@/types/usuario';
import { StyleSheet, type Theme } from '@/utils/styles';

export default function Register() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('motorista');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    // Validação de campos obrigatórios
    if (!nome || !email || !password || !confirmPassword) {
      showWarning('Campos obrigatórios', 'Por favor, preencha todos os campos.');
      return;
    }

    // Validação de nome (mínimo 3 caracteres)
    if (nome.trim().length < 3) {
      showWarning('Nome inválido', 'O nome deve ter pelo menos 3 caracteres.');
      return;
    }

    // Validação de email
    if (!isValidEmail(email)) {
      showWarning('E-mail inválido', 'Por favor, insira um e-mail válido.');
      return;
    }

    // Validação de senha forte
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      showWarning(
        'Senha fraca',
        `A senha precisa:\n• ${passwordValidation.errors.join('\n• ')}`
      );
      return;
    }

    // Verificar se senhas coincidem
    if (password !== confirmPassword) {
      showWarning('Senhas diferentes', 'As senhas digitadas não coincidem.');
      return;
    }

    // Verificar rate limit (proteção contra spam de registros)
    const rateLimitCheck = await signupRateLimiter.checkLimit(email.toLowerCase());
    if (!rateLimitCheck.allowed) {
      showWarning('Muitas tentativas', rateLimitCheck.message || 'Aguarde antes de tentar novamente.');
      return;
    }

    setLoading(true);

    try {
      await authService.signUp(email, password, nome, tipo);

      // Registro bem-sucedido: resetar rate limit
      await signupRateLimiter.recordAttempt(email.toLowerCase(), true);

      showSuccess(
        'Conta criada!',
        'Verifique seu e-mail para confirmar o cadastro.',
        () => router.replace('/auth/login')
      );
    } catch (error: unknown) {
      // Registrar tentativa falha
      await signupRateLimiter.recordAttempt(email.toLowerCase(), false);

      // Usar error mapping para mensagem amigável
      showError(error);
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
          <Card padding="large" style={styles.card} testID="auth-register-card">
            <Text variant="title" style={styles.title}>
              Criar Conta
            </Text>
            <Text tone="muted" style={styles.subtitle}>
              Preencha os dados abaixo para criar sua conta no Rota Mestre
            </Text>

            <View style={styles.form}>
              <Input
                label="Nome Completo"
                required
                placeholder="Digite seu nome"
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />

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

              <Input
                label="Senha"
                required
                placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, maiúscula e número`}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />

              <Input
                label="Confirmar Senha"
                required
                placeholder="Digite a senha novamente"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <View style={styles.tipoSection}>
                <Text variant="label" style={styles.tipoLabel}>
                  Tipo de Conta
                </Text>
                <View style={styles.tipoContainer}>
                  <Button
                    title="Motorista"
                    variant={tipo === 'motorista' ? 'primary' : 'outline'}
                    onPress={() => setTipo('motorista')}
                    style={styles.tipoButton}
                  />
                  <Button
                    title="Gestor"
                    variant={tipo === 'gestor' ? 'primary' : 'outline'}
                    onPress={() => setTipo('gestor')}
                    style={styles.tipoButton}
                  />
                </View>
              </View>

              <Button
                title="Criar Conta"
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                fullWidth
              />

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => router.back()}
              >
                <Text tone="primary" style={styles.backLinkText}>
                  Ja tem uma conta? Faca login
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </ScrollView>
      {AlertDialog}
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
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
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: theme.colors.white,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
  },
  form: {
    marginTop: theme.spacing.sm,
  },
  tipoSection: {
    marginBottom: theme.spacing.md,
  },
  tipoLabel: {
    marginBottom: theme.spacing.sm,
  },
  tipoContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tipoButton: {
    flex: 1,
  },
  backLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  backLinkText: {
    fontSize: theme.typography.sm,
  },
}));
