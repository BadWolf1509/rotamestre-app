import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Button, Card, Input, Text } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { TipoUsuario } from '@/types/usuario';
import { StyleSheet, type Theme } from '@/utils/styles';

export default function Register() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('motorista');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!nome || !email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas nao coincidem');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await authService.signUp(email, password, nome, tipo);
      Alert.alert(
        'Sucesso',
        'Conta criada com sucesso! Verifique seu e-mail para confirmar.',
        [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar conta');
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
                placeholder="Minimo 6 caracteres"
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
