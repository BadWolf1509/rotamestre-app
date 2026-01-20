import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { Button, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function AlterarSenha() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { showWarning, showSuccess, showError, AlertDialog } = useAlert();
  const [saving, setSaving] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  async function handleSave() {
    if (!senhaAtual) {
      showWarning('Erro', 'Digite sua senha atual');
      return;
    }

    if (!novaSenha) {
      showWarning('Erro', 'Digite a nova senha');
      return;
    }

    const validation = validatePassword(novaSenha);
    if (!validation.isValid) {
      showWarning('Erro', validation.message);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      showWarning('Erro', 'As senhas nao coincidem');
      return;
    }

    if (senhaAtual === novaSenha) {
      showWarning('Erro', 'A nova senha deve ser diferente da atual');
      return;
    }

    setSaving(true);

    try {
      const session = await authService.getSession();
      if (!session?.user?.email) {
        throw new Error('Sessao nao encontrada');
      }

      try {
        await authService.signIn(session.user.email, senhaAtual);
      } catch {
        throw new Error('Senha atual incorreta');
      }

      await authService.updatePassword(novaSenha);

      await supabase
        .from('usuarios')
        .update({
          primeira_senha: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      showSuccess('Sucesso!', 'Senha alterada com sucesso!', () => router.back());
    } catch (error: unknown) {
      console.error('Erro ao alterar senha:', error);
      showError(error);
    } finally {
      setSaving(false);
    }
  }

  function validatePassword(password: string): {
    isValid: boolean;
    message: string;
    strength: 'weak' | 'medium' | 'strong' | 'invalid';
  } {
    if (password.length < 8) {
      return { isValid: false, message: 'Minimo 8 caracteres', strength: 'invalid' };
    }

    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Deve conter letra maiuscula', strength: 'invalid' };
    }

    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Deve conter letra minuscula', strength: 'invalid' };
    }

    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Deve conter numero', strength: 'invalid' };
    }

    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLong = password.length >= 12;

    if (hasSpecialChar && isLong) {
      return { isValid: true, message: 'Senha forte', strength: 'strong' };
    }

    if (hasSpecialChar || isLong) {
      return { isValid: true, message: 'Senha media', strength: 'medium' };
    }

    return { isValid: true, message: 'Senha valida', strength: 'weak' };
  }

  const passwordStrength = novaSenha ? validatePassword(novaSenha) : null;
  const passwordsMatch = novaSenha && confirmarSenha && novaSenha === confirmarSenha;

  if (isDesktop) {
    const fields = [
      {
        label: 'Senha Atual',
        value: senhaAtual,
        placeholder: 'Digite sua senha atual',
        secureTextEntry: !showSenhaAtual,
        showPasswordToggle: true,
        isPasswordVisible: showSenhaAtual,
        onTogglePassword: () => setShowSenhaAtual(!showSenhaAtual),
        onChange: setSenhaAtual,
        autoCapitalize: 'none' as const,
      },
      {
        label: 'Nova Senha',
        value: novaSenha,
        placeholder: 'Digite a nova senha',
        secureTextEntry: !showNovaSenha,
        showPasswordToggle: true,
        isPasswordVisible: showNovaSenha,
        onTogglePassword: () => setShowNovaSenha(!showNovaSenha),
        onChange: setNovaSenha,
        autoCapitalize: 'none' as const,
        helperText: passwordStrength?.isValid ? passwordStrength.message : undefined,
        helperTextType: passwordStrength?.strength === 'strong' ? 'success' as const : passwordStrength?.strength === 'medium' ? 'warning' as const : undefined,
        error: passwordStrength && !passwordStrength.isValid ? passwordStrength.message : undefined,
      },
      {
        label: 'Confirmar Nova Senha',
        value: confirmarSenha,
        placeholder: 'Digite a senha novamente',
        secureTextEntry: !showConfirmarSenha,
        showPasswordToggle: true,
        isPasswordVisible: showConfirmarSenha,
        onTogglePassword: () => setShowConfirmarSenha(!showConfirmarSenha),
        onChange: setConfirmarSenha,
        autoCapitalize: 'none' as const,
        helperText: confirmarSenha && passwordsMatch ? 'Senhas coincidem' : undefined,
        helperTextType: passwordsMatch ? 'success' as const : undefined,
        error: confirmarSenha && !passwordsMatch ? 'Senhas nao coincidem' : undefined,
      },
    ];

    const sidePanel = (
      <View style={desktopStyles(theme).sidePanel}>
        <View style={desktopStyles(theme).tipsCard}>
          <Text style={desktopStyles(theme).tipsTitle}>Requisitos obrigatorios:</Text>
          <View style={desktopStyles(theme).tipsList}>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 8 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, novaSenha.length >= 8 && desktopStyles(theme).tipTextValid]}>
                Minimo de 8 caracteres
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[A-Z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[A-Z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[A-Z]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Letra maiuscula
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[a-z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[a-z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[a-z]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Letra minuscula
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[0-9]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[0-9]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[0-9]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Numero
              </Text>
            </View>
          </View>
          <Text style={desktopStyles(theme).tipsSectionTitle}>Para senha forte:</Text>
          <View style={desktopStyles(theme).tipsList}>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Caractere especial (@, #, $, etc.)
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 12 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 12 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, novaSenha.length >= 12 && desktopStyles(theme).tipTextValid]}>
                12 ou mais caracteres
              </Text>
            </View>
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
          primaryButtonDisabled={
            saving ||
            !senhaAtual ||
            !novaSenha ||
            !confirmarSenha ||
            !passwordsMatch ||
            (passwordStrength ? !passwordStrength.isValid : true)
          }
          onPrimaryPress={handleSave}
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
      <ScrollView style={styles(theme).scrollView}>
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
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            secureTextEntry={!showSenhaAtual}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showSenhaAtual ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowSenhaAtual(!showSenhaAtual)}
          />

          <Input
            label="Nova Senha"
            required
            placeholder="Digite a nova senha"
            value={novaSenha}
            onChangeText={setNovaSenha}
            secureTextEntry={!showNovaSenha}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showNovaSenha ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowNovaSenha(!showNovaSenha)}
          />
          {passwordStrength && (
            <Text
              style={[
                styles(theme).helperText,
                passwordStrength.strength === 'strong' && styles(theme).helperTextSuccess,
                passwordStrength.strength === 'medium' && styles(theme).helperTextWarning,
                !passwordStrength.isValid && styles(theme).helperTextError,
              ]}
            >
              {passwordStrength.message}
            </Text>
          )}

          <Input
            label="Confirmar Nova Senha"
            required
            placeholder="Digite a senha novamente"
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            secureTextEntry={!showConfirmarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showConfirmarSenha ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowConfirmarSenha(!showConfirmarSenha)}
          />
          {confirmarSenha && (
            <Text
              style={[
                styles(theme).helperText,
                passwordsMatch
                  ? styles(theme).helperTextSuccess
                  : styles(theme).helperTextError,
              ]}
            >
              {passwordsMatch ? 'Senhas coincidem' : 'Senhas nao coincidem'}
            </Text>
          )}

          <View style={styles(theme).tipsContainer}>
            <Text style={styles(theme).tipsTitle}>Requisitos obrigatorios:</Text>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 8 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, novaSenha.length >= 8 && styles(theme).tipTextValid]}>
                Minimo de 8 caracteres
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[A-Z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[A-Z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[A-Z]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Letra maiuscula
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[a-z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[a-z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[a-z]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Letra minuscula
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[0-9]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[0-9]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[0-9]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Numero
              </Text>
            </View>

            <Text style={[styles(theme).tipsTitle, { marginTop: 12 }]}>Para senha forte:</Text>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[!@#$%^&*(),.?":{}|<>]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Caractere especial (@, #, $, etc.)
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 12 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 12 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, novaSenha.length >= 12 && styles(theme).tipTextValid]}>
                12 ou mais caracteres
              </Text>
            </View>
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
              onPress={handleSave}
              loading={saving}
              disabled={saving || !passwordStrength?.isValid || !passwordsMatch || !senhaAtual}
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
