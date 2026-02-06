import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Button, Card, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { isPasswordValid } from '@/utils/passwordValidation';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { User } from '@supabase/supabase-js';

export default function FirstPasswordScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [user, setUser] = useState<User | null>(null);
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

  async function handleSetPassword() {
    // Validacoes
    if (!newPassword || !confirmPassword) {
      showWarning('Erro', 'Preencha todos os campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      showWarning('Erro', 'As senhas não coincidem');
      return;
    }

    if (!isPasswordValid(newPassword)) {
      showWarning(
        'Senha Fraca',
        'A senha não atende aos requisitos mínimos de segurança. Por favor, crie uma senha mais forte.'
      );
      return;
    }

    try {
      setLoading(true);

      // Verificar se há uma sessão ativa
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        showWarning('Erro', 'Sessão expirada. Por favor, faça login novamente.');
        await supabase.auth.signOut();
        router.replace('/auth/login');
        return;
      }

      // Verificar se o perfil está carregado
      if (!user || !profile) {
        showWarning('Erro', 'Não foi possível carregar os dados do usuário.');
        setLoading(false);
        return;
      }

      // Segurança: verificar se realmente está marcado como primeira_senha
      if (profile.primeira_senha !== true) {
        logger.warn('Usuário tentou acessar first-password sem estar marcado como primeira_senha');
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
          showWarning(
            'Senha Inválida',
            'A nova senha não pode ser igual à senha temporária que você recebeu. Por favor, escolha uma senha diferente.'
          );
          setLoading(false);
          return;
        }

        logger.error('Erro ao atualizar senha', updateError);
        throw new Error(updateError.message || 'Erro ao atualizar senha');
      }

      // Marcar primeira_senha como false
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', user!.id);

      if (dbError) {
        logger.error('Erro ao atualizar primeira_senha', dbError);
      }

      const targetRoute = profile.papel === 'gestor'
        ? '/gestor/inicio'
        : '/motorista';

      const papelNome = profile.papel === 'gestor' ? 'Gestor' : 'Motorista';

      const successMessage =
        `Bem-vindo ao Rota Mestre, ${profile.nome}! ` +
        `Voce sera redirecionado para sua area de ${papelNome}.`;

      showSuccess('Senha Definida com Sucesso!', successMessage, () => router.replace(targetRoute));
    } catch (error: unknown) {
      logger.error('Erro ao definir senha', error);
      const message = error instanceof Error ? error.message : 'Erro ao definir senha. Tente novamente.';
      showError({ title: 'Erro', message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      {AlertDialog}
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(20, insets.bottom + 20) },
        ]}
        keyboardShouldPersistTaps="handled"
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
    </View>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  wrapper: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  container: {
    flex: 1,
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
