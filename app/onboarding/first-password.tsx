import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { Button, Card, Input, Text } from '@/design-system';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { supabase } from '@/lib/supabase';
import { isPasswordValid } from '@/utils/passwordValidation';
import { StyleSheet, type Theme } from '@/utils/styles';

export default function FirstPasswordScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [user, setUser] = useState<any>(null);
  const { profile } = useProfile(user);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, []);

  // Helper para mostrar alertas cross-platform
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  async function handleSetPassword() {
    // Validacoes
    if (!newPassword || !confirmPassword) {
      showAlert('Erro', 'Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('Erro', 'As senhas nao coincidem');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      showAlert(
        'Senha Fraca',
        'A senha nao atende aos requisitos minimos de seguranca. Por favor, crie uma senha mais forte.'
      );
      return;
    }

    try {
      setLoading(true);

      // Verificar se ha uma sessao ativa
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        showAlert('Erro', 'Sessao expirada. Por favor, faca login novamente.');
        await supabase.auth.signOut();
        router.replace('/auth/login');
        return;
      }

      // Verificar se o perfil esta carregado
      if (!user || !profile) {
        showAlert('Erro', 'Nao foi possivel carregar os dados do usuario.');
        setLoading(false);
        return;
      }

      // Seguranca: verificar se realmente esta marcado como primeira_senha
      if (profile.primeira_senha !== true) {
        console.warn('Usuario tentou acessar first-password sem estar marcado como primeira_senha');
        const targetRoute = profile.papel === 'gestor' ? '/gestor/inicio' : '/motorista';
        router.replace(targetRoute);
        return;
      }

      // Atualizar senha no Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (updateError.message.includes('should be different') ||
            updateError.message.includes('same')) {
          showAlert(
            'Senha Invalida',
            'A nova senha nao pode ser igual a senha temporaria que voce recebeu. Por favor, escolha uma senha diferente.'
          );
          setLoading(false);
          return;
        }

        console.error('Erro ao atualizar senha:', updateError);
        throw new Error(updateError.message || 'Erro ao atualizar senha');
      }

      // Marcar primeira_senha como false
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', user.id);

      if (dbError) {
        console.error('Erro ao atualizar primeira_senha:', dbError);
      }

      const targetRoute = profile.papel === 'gestor'
        ? '/gestor/inicio'
        : '/motorista';

      const papelNome = profile.papel === 'gestor' ? 'Gestor' : 'Motorista';

      const successMessage =
        `Bem-vindo ao Rota Mestre, ${profile.nome}! ` +
        `Voce sera redirecionado para sua area de ${papelNome}.`;

      if (Platform.OS === 'web') {
        window.alert(`Senha Definida com Sucesso!\n\n${successMessage}`);
        router.replace(targetRoute);
      } else {
        Alert.alert(
          'Senha Definida com Sucesso!',
          successMessage,
          [
            {
              text: 'Continuar',
              onPress: () => router.replace(targetRoute),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Erro completo:', error);
      showAlert('Erro', error.message || 'Erro ao definir senha. Tente novamente.');
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
          <Card padding="large" style={styles.card} testID="onboarding-first-password-card">
            <View style={styles.header}>
              <Text variant="title" style={styles.welcomeText}>
                Bem-vindo!
              </Text>
              <Text variant="subtitle" style={styles.title}>
                Defina sua Senha
              </Text>
              <Text tone="muted" style={styles.subtitle}>
                Por seguranca, voce precisa criar uma nova senha antes de continuar.
                Esta senha sera usada para acessar o aplicativo.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Input
                label="Nova Senha"
                required
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder="Digite sua nova senha"
                autoCapitalize="none"
                autoFocus
                rightIcon={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowNewPassword(!showNewPassword)}
              />
              <PasswordStrengthIndicator password={newPassword} />
            </View>

            <View style={styles.inputGroup}>
              <Input
                label="Confirmar Nova Senha"
                required
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Digite novamente sua nova senha"
                autoCapitalize="none"
                rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <Text tone="error" style={styles.errorText}>
                  As senhas nao coincidem
                </Text>
              )}
            </View>

            <View style={styles.requirementsBox}>
              <Text variant="label" style={styles.requirementsTitle}>
                Requisitos de Seguranca:
              </Text>
              <Text style={styles.requirementText}>- Minimo de 8 caracteres</Text>
              <Text style={styles.requirementText}>- Pelo menos 1 letra maiuscula</Text>
              <Text style={styles.requirementText}>- Pelo menos 1 letra minuscula</Text>
              <Text style={styles.requirementText}>- Pelo menos 1 numero</Text>
              <Text style={styles.requirementText}>
                - Pelo menos 1 caractere especial (!@#$%&*)
              </Text>
            </View>

            <Button
              title="Definir Senha e Continuar"
              onPress={handleSetPassword}
              loading={loading}
              disabled={loading}
              fullWidth
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Dica: Use uma senha unica que voce nao usa em outros sites.
              </Text>
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
    padding: theme.spacing.xl,
  },
  content: {
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 550,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: theme.colors.white,
  },
  header: {
    marginBottom: theme.spacing['3xl'],
    marginTop: theme.spacing.xl,
  },
  welcomeText: {
    marginBottom: theme.spacing.sm,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  subtitle: {
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.xs,
    marginTop: theme.spacing.xs,
  },
  requirementsBox: {
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  requirementsTitle: {
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  requirementText: {
    fontSize: theme.typography.xs,
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.xs,
  },
  infoBox: {
    backgroundColor: theme.colors.secondaryBg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.secondaryLight,
    marginTop: theme.spacing.lg,
  },
  infoText: {
    fontSize: theme.typography.xs,
    color: theme.colors.secondaryDark,
    lineHeight: theme.typography.lg,
  },
}));
