import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';

export default function AlterarSenha() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [saving, setSaving] = useState(false);

  // Campos
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Visibilidade das senhas
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  async function handleSave() {
    // Validações
    if (!senhaAtual) {
      Alert.alert('Erro', 'Digite sua senha atual');
      return;
    }

    if (!novaSenha) {
      Alert.alert('Erro', 'Digite a nova senha');
      return;
    }

    const validation = validatePassword(novaSenha);
    if (!validation.isValid) {
      Alert.alert('Erro', validation.message);
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (senhaAtual === novaSenha) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da atual');
      return;
    }

    setSaving(true);

    try {
      // Verificar senha atual fazendo login novamente
      const session = await authService.getSession();
      if (!session?.user?.email) {
        throw new Error('Sessão não encontrada');
      }

      // Tentar fazer login com a senha atual para validar
      try {
        await authService.signIn(session.user.email, senhaAtual);
      } catch {
        throw new Error('Senha atual incorreta');
      }

      // Atualizar senha
      await authService.updatePassword(novaSenha);

      // Marcar primeira_senha como false se ainda não estiver
      await supabase
        .from('usuarios')
        .update({
          primeira_senha: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      Alert.alert('Sucesso!', 'Senha alterada com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', error.message || 'Não foi possível alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  function validatePassword(password: string): {
    isValid: boolean;
    message: string;
    strength: 'weak' | 'medium' | 'strong' | 'invalid';
  } {
    // Mínimo 8 caracteres
    if (password.length < 8) {
      return { isValid: false, message: 'Mínimo 8 caracteres', strength: 'invalid' };
    }

    // Deve ter pelo menos uma letra maiúscula
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Deve conter letra maiúscula', strength: 'invalid' };
    }

    // Deve ter pelo menos uma letra minúscula
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Deve conter letra minúscula', strength: 'invalid' };
    }

    // Deve ter pelo menos um número
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Deve conter número', strength: 'invalid' };
    }

    // Verificar força da senha
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLong = password.length >= 12;

    if (hasSpecialChar && isLong) {
      return { isValid: true, message: 'Senha forte', strength: 'strong' };
    }

    if (hasSpecialChar || isLong) {
      return { isValid: true, message: 'Senha média', strength: 'medium' };
    }

    return { isValid: true, message: 'Senha válida', strength: 'weak' };
  }

  const passwordStrength = novaSenha ? validatePassword(novaSenha) : null;
  const passwordsMatch = novaSenha && confirmarSenha && novaSenha === confirmarSenha;

  // Desktop layout
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
        error: confirmarSenha && !passwordsMatch ? 'Senhas não coincidem' : undefined,
      },
    ];

    const sidePanel = (
      <View style={desktopStyles(theme).sidePanel}>
        <View style={desktopStyles(theme).tipsCard}>
          <Text style={desktopStyles(theme).tipsTitle}>Requisitos obrigatórios:</Text>
          <View style={desktopStyles(theme).tipsList}>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 8 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, novaSenha.length >= 8 && desktopStyles(theme).tipTextValid]}>
                Mínimo de 8 caracteres
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[A-Z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[A-Z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[A-Z]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Letra maiúscula
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[a-z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[a-z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[a-z]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Letra minúscula
              </Text>
            </View>
            <View style={desktopStyles(theme).tipRow}>
              <Ionicons
                name={/[0-9]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[0-9]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[desktopStyles(theme).tipText, /[0-9]/.test(novaSenha) && desktopStyles(theme).tipTextValid]}>
                Número
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
      <FormDesktopLayout
        title="Alterar Senha"
        subtitle="Crie uma senha forte para proteger sua conta"
        fields={fields}
        primaryButtonText="Alterar Senha"
        primaryButtonDisabled={saving || !senhaAtual || !novaSenha || !confirmarSenha || !passwordsMatch || (passwordStrength ? !passwordStrength.isValid : true)}
        onPrimaryPress={handleSave}
        secondaryButtonText="Cancelar"
        onSecondaryPress={() => router.push('/perfil')}
        loading={saving}
        sidePanel={sidePanel}
        backPath="/perfil"
      />
    );
  }

  // Mobile layout
  return (
    <View style={styles(theme).container}>
      <ScrollView style={styles(theme).scrollView}>
        {/* Header */}
        <View style={styles(theme).header}>
          <View style={styles(theme).headerContent}>
            <Text style={styles(theme).headerSubtitle}>
              Crie uma senha forte para proteger sua conta
            </Text>
          </View>
        </View>

        {/* Formulário */}
        <View style={styles(theme).form}>
          {/* Senha Atual */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>
              Senha Atual <Text style={styles(theme).required}>*</Text>
            </Text>
            <View style={styles(theme).passwordContainer}>
              <TextInput
                style={styles(theme).input}
                placeholder="Digite sua senha atual"
                value={senhaAtual}
                onChangeText={setSenhaAtual}
                secureTextEntry={!showSenhaAtual}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles(theme).passwordToggle}
                onPress={() => setShowSenhaAtual(!showSenhaAtual)}
              >
                <Ionicons
                  name={showSenhaAtual ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Nova Senha */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>
              Nova Senha <Text style={styles(theme).required}>*</Text>
            </Text>
            <View style={styles(theme).passwordContainer}>
              <TextInput
                style={styles(theme).input}
                placeholder="Digite a nova senha"
                value={novaSenha}
                onChangeText={setNovaSenha}
                secureTextEntry={!showNovaSenha}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles(theme).passwordToggle}
                onPress={() => setShowNovaSenha(!showNovaSenha)}
              >
                <Ionicons
                  name={showNovaSenha ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
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
          </View>

          {/* Confirmar Senha */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>
              Confirmar Nova Senha <Text style={styles(theme).required}>*</Text>
            </Text>
            <View style={styles(theme).passwordContainer}>
              <TextInput
                style={styles(theme).input}
                placeholder="Digite a senha novamente"
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                secureTextEntry={!showConfirmarSenha}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles(theme).passwordToggle}
                onPress={() => setShowConfirmarSenha(!showConfirmarSenha)}
              >
                <Ionicons
                  name={showConfirmarSenha ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={theme.colors.gray500}
                />
              </TouchableOpacity>
            </View>
            {confirmarSenha && (
              <Text
                style={[
                  styles(theme).helperText,
                  passwordsMatch
                    ? styles(theme).helperTextSuccess
                    : styles(theme).helperTextError,
                ]}
              >
                {passwordsMatch ? 'Senhas coincidem' : 'Senhas não coincidem'}
              </Text>
            )}
          </View>

          {/* Requisitos de Senha */}
          <View style={styles(theme).tipsContainer}>
            <Text style={styles(theme).tipsTitle}>Requisitos obrigatórios:</Text>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={novaSenha.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={novaSenha.length >= 8 ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, novaSenha.length >= 8 && styles(theme).tipTextValid]}>
                Mínimo de 8 caracteres
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[A-Z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[A-Z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[A-Z]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Letra maiúscula
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[a-z]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[a-z]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[a-z]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Letra minúscula
              </Text>
            </View>
            <View style={styles(theme).tipRow}>
              <Ionicons
                name={/[0-9]/.test(novaSenha) ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={/[0-9]/.test(novaSenha) ? theme.colors.success : theme.colors.gray400}
              />
              <Text style={[styles(theme).tipText, /[0-9]/.test(novaSenha) && styles(theme).tipTextValid]}>
                Número
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

          {/* Botões inline */}
          <View style={styles(theme).buttonsContainer}>
            <TouchableOpacity
              style={styles(theme).buttonSecondary}
              onPress={() => router.push('/perfil')}
              disabled={saving}
            >
              <Text style={styles(theme).buttonSecondaryText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles(theme).buttonPrimary,
                (saving || !passwordStrength?.isValid || !passwordsMatch || !senhaAtual) && styles(theme).buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || !passwordStrength?.isValid || !passwordsMatch || !senhaAtual}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <Text style={styles(theme).buttonPrimaryText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const desktopStyles = (theme: any) =>
  StyleSheet.create({
    sidePanel: {
      flex: 1,
    },
    tipsCard: {
      backgroundColor: theme.colors.primaryBg,
      borderRadius: 12,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.colors.primaryLight,
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.primaryDark,
      marginBottom: 16,
    },
    tipsSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.gray600,
      marginTop: 20,
      marginBottom: 12,
    },
    tipsList: {
      gap: 12,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tipText: {
      fontSize: 14,
      color: theme.colors.gray500,
      lineHeight: 20,
    },
    tipTextValid: {
      color: theme.colors.success,
    },
  });

const styles = (theme: any) =>
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
      paddingTop: 20,
      paddingBottom: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerContent: {
      flex: 1,
    },
    headerSubtitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.gray900,
    },
    form: {
      backgroundColor: theme.colors.white,
      marginHorizontal: 16,
      borderRadius: 12,
      padding: 20,
      marginBottom: 24,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.gray700,
      marginBottom: 8,
    },
    required: {
      color: theme.colors.error,
    },
    passwordContainer: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.gray300,
      borderRadius: 8,
      padding: 12,
      paddingRight: 48,
      fontSize: 16,
      color: theme.colors.gray900,
      backgroundColor: theme.colors.white,
    },
    passwordToggle: {
      position: 'absolute',
      right: 12,
      top: 12,
      padding: 4,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.gray500,
      marginTop: 4,
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
      padding: 16,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 20,
    },
    tipsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
      marginBottom: 8,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    tipText: {
      fontSize: 13,
      color: theme.colors.gray500,
    },
    tipTextValid: {
      color: theme.colors.success,
    },
    buttonsContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    buttonPrimary: {
      flex: 1,
      backgroundColor: theme.colors.secondary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    buttonPrimaryText: {
      color: theme.colors.white,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonSecondary: {
      flex: 1,
      backgroundColor: theme.colors.white,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.gray300,
      minHeight: 50,
    },
    buttonSecondaryText: {
      color: theme.colors.gray700,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
