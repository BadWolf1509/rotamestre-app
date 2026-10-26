import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Button, Card, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useProfile } from '@/hooks/useProfile';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { emitProfileUpdate } from '@/lib/profileEvents';
// Regra única de senha (`passwordSchema`) + confirmação: a da redefinição.
import {
  resetPasswordSchema as primeiraSenhaSchema,
  type ResetPasswordInput as PrimeiraSenhaInput,
} from '@/lib/schemas/auth';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme } from '@/utils/styles';

import type { User } from '@supabase/supabase-js';

function FirstPasswordContent() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [user, setUser] = useState<User | null>(null);
  const { profile } = useProfile(user);

  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // A senha nova já foi aceita pelo Auth, mas `primeira_senha` não foi
  // marcada: o próximo toque só tenta marcar de novo. Trocar a senha outra vez
  // falharia ("igual à atual") e o aviso falaria da senha temporária.
  const senhaJaTrocadaRef = useRef(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PrimeiraSenhaInput>({
    resolver: zodResolver(primeiraSenhaSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const newPassword = watch('password');

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
    }
    loadUser();
  }, []);

  /** Grava `primeira_senha = false`. A RLS recusa sem erro: confere a linha. */
  async function marcarSenhaDefinida(usuarioId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ primeira_senha: false })
      .eq('id', usuarioId)
      .select('id');
    if (error) {
      logger.error('Erro ao atualizar primeira_senha', error);
      return false;
    }
    if ((data?.length ?? 0) === 0) {
      logger.warn('UPDATE de primeira_senha não alterou nenhuma linha');
      return false;
    }
    return true;
  }

  const handleSetPassword = handleSubmit(async ({ password }) => {
    try {
      setLoading(true);

      // Verificar se há uma sessão ativa
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        showWarning(
          'Erro',
          'Sessão expirada. Por favor, faça login novamente.',
        );
        await authService.signOut();
        router.replace('/auth/login');
        return;
      }

      // Verificar se o perfil está carregado
      if (!user || !profile) {
        showWarning('Erro', 'Não foi possível carregar os dados do usuário.');
        return;
      }

      // Segurança: verificar se realmente está marcado como primeira_senha
      if (profile.primeira_senha !== true) {
        logger.warn(
          'Usuário tentou acessar first-password sem estar marcado como primeira_senha',
        );
        const targetRoute =
          profile.papel === 'gestor' ? '/gestor/inicio' : '/motorista';
        router.replace(targetRoute);
        return;
      }

      if (!senhaJaTrocadaRef.current) {
        // Pela authService, que também encerra as OUTRAS sessões: quem
        // conhecia a senha temporária (o gestor que criou a conta) não segue
        // logado. A sessão desta tela é um login normal, então
        // `scope: 'others'` mantém ela.
        try {
          await authService.updatePassword(password);
        } catch (updateError) {
          const mensagem =
            updateError instanceof Error ? updateError.message : '';
          if (
            mensagem.includes('should be different') ||
            mensagem.includes('same')
          ) {
            showWarning(
              'Senha Inválida',
              'A nova senha não pode ser igual à senha temporária que você recebeu. Por favor, escolha uma senha diferente.',
            );
            return;
          }

          logger.error('Erro ao atualizar senha', updateError);
          throw updateError;
        }
        senhaJaTrocadaRef.current = true;
      }

      // Sem a marca, o próximo login cairia de novo na troca obrigatória:
      // não anuncia sucesso, e o botão vira "tentar de novo" só da marca.
      if (!(await marcarSenhaDefinida(user.id))) {
        showError({
          title: 'Troca não registrada',
          message:
            'Sua nova senha já vale, mas não conseguimos registrar a troca. Toque em "Definir Senha e Continuar" para tentar de novo.',
        });
        return;
      }

      // `primeira_senha` mora no perfil: as instâncias de useUser recarregam.
      emitProfileUpdate();

      const targetRoute =
        profile.papel === 'gestor' ? '/gestor/inicio' : '/motorista';

      const papelNome = profile.papel === 'gestor' ? 'Gestor' : 'Motorista';

      const successMessage =
        `Bem-vindo ao Rota Mestre, ${profile.nome}! ` +
        `Você será redirecionado para sua área de ${papelNome}.`;

      showSuccess('Senha Definida com Sucesso!', successMessage, () =>
        router.replace(targetRoute),
      );
    } catch (error: unknown) {
      logger.error('Erro ao definir senha', error);
      // Mensagem do mapeamento, nunca o texto cru do servidor.
      const { title, message } = getErrorMessage(error);
      showError({ title, message });
    } finally {
      setLoading(false);
    }
  });

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
          <Card
            padding="large"
            style={styles.card}
            testID="onboarding-first-password-card"
          >
            <View style={styles.header}>
              <Text variant="title" style={styles.welcomeText}>
                Bem-vindo!
              </Text>
              <Text variant="subtitle" style={styles.title}>
                Defina sua Senha
              </Text>
              <Text tone="muted" style={styles.subtitle}>
                Por segurança, você precisa criar uma nova senha antes de
                continuar. Esta senha será usada para acessar o aplicativo.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Nova Senha"
                    required
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showNewPassword}
                    placeholder="Digite sua nova senha"
                    autoCapitalize="none"
                    autoFocus
                    rightIcon={
                      showNewPassword ? 'eye-off-outline' : 'eye-outline'
                    }
                    onRightIconPress={() =>
                      setShowNewPassword(!showNewPassword)
                    }
                    error={errors.password?.message}
                  />
                )}
              />
              <PasswordStrengthIndicator password={newPassword} />
            </View>

            <View style={styles.inputGroup}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { value, onChange, onBlur } }) => (
                  <Input
                    label="Confirmar Nova Senha"
                    required
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Digite novamente sua nova senha"
                    autoCapitalize="none"
                    rightIcon={
                      showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
                    }
                    onRightIconPress={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    error={errors.confirmPassword?.message}
                  />
                )}
              />
            </View>

            <View style={styles.requirementsBox}>
              <Text variant="label" style={styles.requirementsTitle}>
                Requisitos de Segurança:
              </Text>
              <Text style={styles.requirementText}>
                - Mínimo de 8 caracteres
              </Text>
              <Text style={styles.requirementText}>
                - Pelo menos 1 letra maiúscula
              </Text>
              <Text style={styles.requirementText}>
                - Pelo menos 1 letra minúscula
              </Text>
              <Text style={styles.requirementText}>- Pelo menos 1 número</Text>
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
                Dica: Use uma senha única que você não usa em outros sites.
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

/** Invólucro com ErrorBoundary — ver comentário em app/auth/login.tsx. */
export default function FirstPasswordScreen() {
  return (
    <ErrorBoundary>
      <FirstPasswordContent />
    </ErrorBoundary>
  );
}
