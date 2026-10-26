import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { Button, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { authService } from '@/lib/auth';
import { classificarFalhaSenhaAtual } from '@/lib/auth/falhaSenhaAtual';
import { logger } from '@/lib/logger';
import { trocarSenhaSchema, type TrocarSenhaInput } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function AlterarSenha() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TrocarSenhaInput>({
    resolver: zodResolver(trocarSenhaSchema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const novaSenha = watch('novaSenha');
  const confirmarSenha = watch('confirmarSenha');

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  async function onSubmit({ senhaAtual, novaSenha: nova }: TrocarSenhaInput) {
    setSaving(true);

    try {
      const session = await authService.getSession();
      if (!session?.user?.email) {
        throw new Error('Sessão não encontrada');
      }

      try {
        await authService.signIn(session.user.email, senhaAtual);
      } catch (erroLogin) {
        // Quatro leituras (ver `falhaSenhaAtual.ts`): senha recusada, sem
        // rede, servidor fora — e perfil que não carregou DEPOIS de a senha
        // ser aceita, que devolve null e segue com a troca.
        const falha = classificarFalhaSenhaAtual(erroLogin);
        if (falha) {
          logger.warn('[AlterarSenha] Senha atual não conferida', erroLogin);
          showWarning(falha.titulo, falha.mensagem);
          return;
        }
      }

      await authService.updatePassword(nova);

      await supabase
        .from('usuarios')
        .update({
          primeira_senha: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      showSuccess('Sucesso!', 'Senha alterada com sucesso!', () =>
        router.back(),
      );
    } catch (error: unknown) {
      logger.error('Erro ao alterar senha:', error);
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  const passwordsMatch =
    !!novaSenha && !!confirmarSenha && novaSenha === confirmarSenha;

  return (
    <ErrorBoundary>
      <View style={styles(theme).container}>
        <ScrollView
          style={styles(theme).scrollView}
          contentContainerStyle={{
            paddingBottom: Math.max(20, insets.bottom + 20),
          }}
        >
          <View style={styles(theme).header}>
            <View style={styles(theme).headerContent}>
              <Text style={styles(theme).headerSubtitle}>
                Crie uma senha forte para proteger sua conta
              </Text>
            </View>
          </View>

          <View style={styles(theme).form}>
            <Controller
              control={control}
              name="senhaAtual"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Senha Atual"
                  required
                  placeholder="Digite sua senha atual"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showSenhaAtual}
                  autoCapitalize="none"
                  autoCorrect={false}
                  rightIcon={showSenhaAtual ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowSenhaAtual(!showSenhaAtual)}
                  error={errors.senhaAtual?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="novaSenha"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nova Senha"
                  required
                  placeholder="Digite a nova senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showNovaSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  rightIcon={showNovaSenha ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowNovaSenha(!showNovaSenha)}
                  error={errors.novaSenha?.message}
                />
              )}
            />
            <PasswordStrengthIndicator password={novaSenha} />

            <Controller
              control={control}
              name="confirmarSenha"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar Nova Senha"
                  required
                  placeholder="Digite a senha novamente"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry={!showConfirmarSenha}
                  autoCapitalize="none"
                  autoCorrect={false}
                  rightIcon={
                    showConfirmarSenha ? 'eye-off-outline' : 'eye-outline'
                  }
                  onRightIconPress={() =>
                    setShowConfirmarSenha(!showConfirmarSenha)
                  }
                  error={errors.confirmarSenha?.message}
                />
              )}
            />
            {passwordsMatch && (
              <Text
                style={[
                  styles(theme).helperText,
                  styles(theme).helperTextSuccess,
                ]}
              >
                Senhas coincidem
              </Text>
            )}

            <View style={styles(theme).tipsContainer}>
              <Text style={styles(theme).tipsTitle}>Requisitos da senha:</Text>
              <Text style={styles(theme).tipText}>
                - Mínimo de 8 caracteres
              </Text>
              <Text style={styles(theme).tipText}>
                - Letras maiúsculas e minúsculas
              </Text>
              <Text style={styles(theme).tipText}>- Pelo menos um número</Text>
              <Text style={styles(theme).tipText}>
                - Pelo menos um caractere especial (@, #, $, etc.)
              </Text>
            </View>

            <View style={styles(theme).buttonsContainer}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={() => router.back()}
                disabled={saving}
                style={styles(theme).buttonSecondary}
              />

              <Button
                title="Salvar"
                variant="secondary"
                onPress={handleSubmit(onSubmit)}
                loading={saving}
                disabled={saving}
                style={styles(theme).buttonPrimary}
              />
            </View>
          </View>
        </ScrollView>
        {AlertDialog}
      </View>
    </ErrorBoundary>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.gray50,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      backgroundColor: theme.colors.white,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
      marginBottom: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerContent: {
      flex: 1,
    },
    headerSubtitle: {
      fontSize: theme.typography.base,
      fontFamily: theme.typography.fontSansBold,
      color: theme.colors.gray900,
    },
    form: {
      backgroundColor: theme.colors.white,
      marginHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing['2xl'],
    },
    helperText: {
      fontSize: theme.typography.xs,
      color: theme.colors.gray500,
      marginBottom: theme.spacing.md,
      marginTop: -theme.spacing.sm,
    },
    helperTextSuccess: {
      color: theme.colors.success,
    },
    helperTextWarning: {
      color: theme.colors.warning,
    },
    helperTextError: {
      color: theme.colors.error,
    },
    tipsContainer: {
      backgroundColor: theme.colors.primary + '10',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    tipsTitle: {
      fontSize: theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.primary,
      marginBottom: theme.spacing.sm,
    },
    tipText: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray700,
      marginBottom: theme.spacing.xs,
    },
    buttonsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    buttonPrimary: {
      flex: 1,
    },
    buttonSecondary: {
      flex: 1,
    },
  });
