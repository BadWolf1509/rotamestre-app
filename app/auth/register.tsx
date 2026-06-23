import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Button, Card, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { signupRateLimiter } from '@/lib/rateLimiter';
import {
  PASSWORD_MIN_LENGTH,
  registerSchema,
  type RegisterInput,
} from '@/lib/schemas';
import { StyleSheet, type Theme } from '@/utils/styles';

export default function Register() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [loading, setLoading] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nome: '',
      email: '',
      password: '',
      confirmPassword: '',
      tipo: 'motorista',
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  async function onSubmit(data: RegisterInput) {
    const { nome, email, password, tipo } = data;

    // Verificar rate limit (proteção contra spam de registros)
    const rateLimitCheck = await signupRateLimiter.checkLimit(email);
    if (!rateLimitCheck.allowed) {
      showWarning(
        'Muitas tentativas',
        rateLimitCheck.message || 'Aguarde antes de tentar novamente.',
      );
      return;
    }

    setLoading(true);

    try {
      await authService.signUp(email, password, nome, tipo);

      // Registro bem-sucedido: resetar rate limit
      await signupRateLimiter.recordAttempt(email, true);

      showSuccess(
        'Conta criada!',
        'Verifique seu e-mail para confirmar o cadastro.',
        () => router.replace('/auth/login'),
      );
    } catch (error: unknown) {
      // Registrar tentativa falha
      await signupRateLimiter.recordAttempt(email, false);

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom + 20) },
        ]}
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
              <Controller
                control={control}
                name="nome"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nome Completo"
                    required
                    placeholder="Digite seu nome"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="words"
                    error={errors.nome?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="E-mail"
                    required
                    placeholder="Digite seu e-mail"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    error={errors.email?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Senha"
                    required
                    placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres, maiúscula, número e especial`}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    autoComplete="password"
                    error={errors.password?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirmar Senha"
                    required
                    placeholder="Digite a senha novamente"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry
                    error={errors.confirmPassword?.message}
                  />
                )}
              />

              <View style={styles.tipoSection}>
                <Text variant="label" style={styles.tipoLabel}>
                  Tipo de Conta
                </Text>
                <Controller
                  control={control}
                  name="tipo"
                  render={({ field: { onChange, value } }) => (
                    <View style={styles.tipoContainer}>
                      <Button
                        title="Motorista"
                        variant={value === 'motorista' ? 'primary' : 'outline'}
                        onPress={() => onChange('motorista')}
                        style={styles.tipoButton}
                      />
                      <Button
                        title="Gestor"
                        variant={value === 'gestor' ? 'primary' : 'outline'}
                        onPress={() => onChange('gestor')}
                        style={styles.tipoButton}
                      />
                    </View>
                  )}
                />
              </View>

              <Button
                title="Criar Conta"
                onPress={handleSubmit(onSubmit)}
                loading={loading}
                disabled={loading}
                fullWidth
              />

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => router.back()}
                accessibilityLabel="Já tem uma conta? Fazer login"
                accessibilityRole="link"
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
