import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useController, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { Button, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { classificarFalhaSenhaAtual } from '@/lib/auth/falhaSenhaAtual';
import { logger } from '@/lib/logger';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_SPECIAL_REGEX,
  trocarSenhaSchema,
  type TrocarSenhaInput,
} from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function AlterarSenha() {
  return (
    <ErrorBoundary>
      <AlterarSenhaContent />
    </ErrorBoundary>
  );
}

interface EstilosRequisito {
  tipRow: object;
  tipText: object;
  tipTextValid: object;
}

function AlterarSenhaContent() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [saving, setSaving] = useState(false);

  const { control, handleSubmit } = useForm<TrocarSenhaInput>({
    resolver: zodResolver(trocarSenhaSchema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  // `useController` (e não `Controller`) porque os dois layouts, mobile e
  // desktop, leem os mesmos três campos.
  const atual = useController({ control, name: 'senhaAtual' });
  const nova = useController({ control, name: 'novaSenha' });
  const confirmacao = useController({ control, name: 'confirmarSenha' });
  const novaSenha = nova.field.value;
  const confirmarSenha = confirmacao.field.value;

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  async function onSubmit({
    senhaAtual,
    novaSenha: novaDigitada,
  }: TrocarSenhaInput) {
    setSaving(true);

    try {
      const session = await authService.getSession();
      if (!session?.user?.email) {
        throw new Error('Sessão não encontrada');
      }

      try {
        await authService.signIn(session.user.email, senhaAtual);
      } catch (erroLogin) {
        // Antes, TODA falha aqui virava "Senha atual incorreta". Agora: senha
        // recusada, sem rede ou servidor fora (cada um com a sua mensagem), e
        // perfil que não carregou DEPOIS de a senha ser aceita, que segue com
        // a troca. Ver `falhaSenhaAtual.ts`, igual à tela do motorista.
        const falha = classificarFalhaSenhaAtual(erroLogin);
        if (falha) {
          logger.warn('[AlterarSenha] Senha atual não conferida', erroLogin);
          showWarning(falha.titulo, falha.mensagem);
          return;
        }
      }

      await authService.updatePassword(novaDigitada);

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
      logger.error('Erro ao alterar senha', error);
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  const passwordsMatch =
    !!novaSenha && !!confirmarSenha && novaSenha === confirmarSenha;

  // Os requisitos obrigatórios são exatamente os do `passwordSchema`.
  const requisitos = [
    {
      ok: novaSenha.length >= PASSWORD_MIN_LENGTH,
      texto: `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`,
    },
    { ok: /[A-Z]/.test(novaSenha), texto: 'Letra maiúscula' },
    { ok: /[a-z]/.test(novaSenha), texto: 'Letra minúscula' },
    { ok: /[0-9]/.test(novaSenha), texto: 'Número' },
    {
      ok: PASSWORD_SPECIAL_REGEX.test(novaSenha),
      texto: 'Caractere especial (@, #, $, etc.)',
    },
  ];
  const bonus = [
    { ok: novaSenha.length >= 12, texto: '12 ou mais caracteres' },
  ];

  // Função chamada como {renderLinhas()}, nunca <Linhas />: ver CLAUDE.md.
  function renderLinhas(
    itens: { ok: boolean; texto: string }[],
    estilos: EstilosRequisito,
  ) {
    return itens.map(({ ok, texto }) => (
      <View key={texto} style={estilos.tipRow}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={ok ? theme.colors.success : theme.colors.gray400}
        />
        <Text style={[estilos.tipText, ok && estilos.tipTextValid]}>
          {texto}
        </Text>
      </View>
    ));
  }

  if (isDesktop) {
    const fields = [
      {
        label: 'Senha Atual',
        value: atual.field.value,
        placeholder: 'Digite sua senha atual',
        secureTextEntry: !showSenhaAtual,
        showPasswordToggle: true,
        isPasswordVisible: showSenhaAtual,
        onTogglePassword: () => setShowSenhaAtual(!showSenhaAtual),
        onChange: atual.field.onChange,
        autoCapitalize: 'none' as const,
        error: atual.fieldState.error?.message,
      },
      {
        label: 'Nova Senha',
        value: novaSenha,
        placeholder: 'Digite a nova senha',
        secureTextEntry: !showNovaSenha,
        showPasswordToggle: true,
        isPasswordVisible: showNovaSenha,
        onTogglePassword: () => setShowNovaSenha(!showNovaSenha),
        onChange: nova.field.onChange,
        autoCapitalize: 'none' as const,
        error: nova.fieldState.error?.message,
      },
      {
        label: 'Confirmar Nova Senha',
        value: confirmarSenha,
        placeholder: 'Digite a senha novamente',
        secureTextEntry: !showConfirmarSenha,
        showPasswordToggle: true,
        isPasswordVisible: showConfirmarSenha,
        onTogglePassword: () => setShowConfirmarSenha(!showConfirmarSenha),
        onChange: confirmacao.field.onChange,
        autoCapitalize: 'none' as const,
        helperText: passwordsMatch ? 'Senhas coincidem' : undefined,
        helperTextType: passwordsMatch ? ('success' as const) : undefined,
        error: confirmacao.fieldState.error?.message,
      },
    ];

    const sidePanel = (
      <View style={desktopStyles(theme).sidePanel}>
        <View style={desktopStyles(theme).tipsCard}>
          <Text style={desktopStyles(theme).tipsTitle}>
            Requisitos obrigatórios:
          </Text>
          <View style={desktopStyles(theme).tipsList}>
            {renderLinhas(requisitos, desktopStyles(theme))}
          </View>
          <Text style={desktopStyles(theme).tipsSectionTitle}>
            Para senha forte:
          </Text>
          <View style={desktopStyles(theme).tipsList}>
            {renderLinhas(bonus, desktopStyles(theme))}
          </View>
        </View>
      </View>
    );

    return (
      <>
        <FormDesktopLayout
          title="Alterar Senha"
          subtitle="Crie uma senha forte para proteger sua conta"
          fields={fields}
          primaryButtonText="Alterar Senha"
          primaryButtonDisabled={saving}
          onPrimaryPress={handleSubmit(onSubmit)}
          secondaryButtonText="Cancelar"
          onSecondaryPress={() => router.push('/perfil')}
          loading={saving}
          sidePanel={sidePanel}
          backPath="/perfil"
        />
        {AlertDialog}
      </>
    );
  }

  return (
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
          <Input
            label="Senha Atual"
            required
            placeholder="Digite sua senha atual"
            value={atual.field.value}
            onChangeText={atual.field.onChange}
            onBlur={atual.field.onBlur}
            secureTextEntry={!showSenhaAtual}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showSenhaAtual ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowSenhaAtual(!showSenhaAtual)}
            error={atual.fieldState.error?.message}
          />

          <Input
            label="Nova Senha"
            required
            placeholder="Digite a nova senha"
            value={novaSenha}
            onChangeText={nova.field.onChange}
            onBlur={nova.field.onBlur}
            secureTextEntry={!showNovaSenha}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showNovaSenha ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowNovaSenha(!showNovaSenha)}
            error={nova.fieldState.error?.message}
          />

          <Input
            label="Confirmar Nova Senha"
            required
            placeholder="Digite a senha novamente"
            value={confirmarSenha}
            onChangeText={confirmacao.field.onChange}
            onBlur={confirmacao.field.onBlur}
            secureTextEntry={!showConfirmarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showConfirmarSenha ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowConfirmarSenha(!showConfirmarSenha)}
            error={confirmacao.fieldState.error?.message}
          />
          {passwordsMatch && (
            <Text
              style={[styles(theme).helperText, styles(theme).helperTextSuccess]}
            >
              Senhas coincidem
            </Text>
          )}

          <View style={styles(theme).tipsContainer}>
            <Text style={styles(theme).tipsTitle}>
              Requisitos obrigatórios:
            </Text>
            {renderLinhas(requisitos, styles(theme))}

            <Text style={[styles(theme).tipsTitle, { marginTop: 12 }]}>
              Para senha forte:
            </Text>
            {renderLinhas(bonus, styles(theme))}
          </View>

          <View style={styles(theme).buttonsContainer}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={() => router.push('/perfil')}
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
  );
}

const desktopStyles = (theme: Theme) =>
  StyleSheet.create({
    sidePanel: {
      flex: 1,
    },
    tipsCard: {
      backgroundColor: theme.colors.primaryBg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing['2xl'],
      borderWidth: 1,
      borderColor: theme.colors.primaryLight,
    },
    tipsTitle: {
      fontSize: theme.typography.base,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.primaryDark,
      marginBottom: theme.spacing.md,
    },
    tipsSectionTitle: {
      fontSize: theme.typography.sm,
      fontFamily: theme.typography.fontSansSemiBold,
      color: theme.colors.gray600,
      marginTop: theme.spacing.xl,
      marginBottom: theme.spacing.md,
    },
    tipsList: {
      gap: theme.spacing.md,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    tipText: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
      lineHeight: theme.typography.xl,
    },
    tipTextValid: {
      color: theme.colors.success,
    },
  });

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
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
    },
    tipText: {
      fontSize: theme.typography.sm,
      color: theme.colors.gray500,
    },
    tipTextValid: {
      color: theme.colors.success,
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
