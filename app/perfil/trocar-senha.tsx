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
    // ValidaÃ§Ãµes
    if (!senhaAtual) {
      Alert.alert('Erro', 'Digite sua senha atual');
      return;
    }

    if (!novaSenha) {
      Alert.alert('Erro', 'Digite a nova senha');
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter no mÃ­nimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas nÃ£o coincidem');
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
        throw new Error('SessÃ£o nÃ£o encontrada');
      }

      // Tentar fazer login com a senha atual para validar
      try {
        await authService.signIn(session.user.email, senhaAtual);
      } catch {
        throw new Error('Senha atual incorreta');
      }

      // Atualizar senha
      await authService.updatePassword(novaSenha);

      // Marcar primeira_senha como false se ainda nÃ£o estiver
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
      Alert.alert('Erro', error.message || 'NÃ£o foi possÃ­vel alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  function validatePassword(password: string): {
    isValid: boolean;
    message: string;
  } {
    if (password.length < 6) {
      return { isValid: false, message: 'MÃ­nimo 6 caracteres' };
    }
    if (password.length >= 6 && password.length < 8) {
      return { isValid: true, message: 'Senha fraca' };
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { isValid: true, message: 'Senha mÃ©dia' };
    }
    return { isValid: true, message: 'Senha forte' };
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
        secureTextEntry: true,
        onChange: setSenhaAtual,
        autoCapitalize: 'none' as const,
      },
      {
        label: 'Nova Senha',
        value: novaSenha,
        placeholder: 'Digite a nova senha',
        secureTextEntry: true,
        onChange: setNovaSenha,
        autoCapitalize: 'none' as const,
        helperText: passwordStrength?.message,
        error: passwordStrength && !passwordStrength.isValid ? passwordStrength.message : undefined,
      },
      {
        label: 'Confirmar Nova Senha',
        value: confirmarSenha,
        placeholder: 'Digite a senha novamente',
        secureTextEntry: true,
        onChange: setConfirmarSenha,
        autoCapitalize: 'none' as const,
        helperText: confirmarSenha ? (passwordsMatch ? 'Senhas coincidem' : undefined) : undefined,
        error: confirmarSenha && !passwordsMatch ? 'Senhas n├úo coincidem' : undefined,
      },
    ];

    const sidePanel = (
      <View style={desktopStyles(theme).sidePanel}>
        <View style={desktopStyles(theme).tipsCard}>
          <Text style={desktopStyles(theme).tipsTitle}>Dicas para uma senha forte:</Text>
          <View style={desktopStyles(theme).tipsList}>
            <Text style={desktopStyles(theme).tipText}>âœ“ MÃ­nimo de 6 caracteres</Text>
            <Text style={desktopStyles(theme).tipText}>âœ“ Use letras maiÃºsculas e minÃºsculas</Text>
            <Text style={desktopStyles(theme).tipText}>âœ“ Inclua nÃºmeros</Text>
            <Text style={desktopStyles(theme).tipText}>âœ“ Adicione caracteres especiais (@, #, $, etc.)</Text>
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

        {/* FormulÃ¡rio */}
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
                <Text style={styles(theme).passwordToggleText}>
                  {showSenhaAtual ? 'ðŸ‘ï¸' : 'ðŸ‘ï¸â€ðŸ—¨ï¸'}
                </Text>
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
                <Text style={styles(theme).passwordToggleText}>
                  {showNovaSenha ? 'ðŸ‘ï¸' : 'ðŸ‘ï¸â€ðŸ—¨ï¸'}
                </Text>
              </TouchableOpacity>
            </View>
            {passwordStrength && (
              <Text
                style={[
                  styles(theme).helperText,
                  passwordStrength.message === 'Senha forte' &&
                    styles(theme).helperTextSuccess,
                  passwordStrength.message === 'Senha mÃ©dia' &&
                    styles(theme).helperTextWarning,
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
                <Text style={styles(theme).passwordToggleText}>
                  {showConfirmarSenha ? 'ðŸ‘ï¸' : 'ðŸ‘ï¸â€ðŸ—¨ï¸'}
                </Text>
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
                {passwordsMatch ? 'Senhas coincidem' : 'Senhas nÃ£o coincidem'}
              </Text>
            )}
          </View>

          {/* Dicas de SeguranÃ§a */}
          <View style={styles(theme).tipsContainer}>
            <Text style={styles(theme).tipsTitle}>Dicas para uma senha forte:</Text>
            <Text style={styles(theme).tipText}>â€¢ MÃ­nimo de 6 caracteres</Text>
            <Text style={styles(theme).tipText}>
              â€¢ Use letras maiÃºsculas e minÃºsculas
            </Text>
            <Text style={styles(theme).tipText}>â€¢ Inclua nÃºmeros</Text>
            <Text style={styles(theme).tipText}>
              â€¢ Adicione caracteres especiais (@, #, $, etc.)
            </Text>
          </View>

          {/* BotÃµes inline */}
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
                saving && styles(theme).buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
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
    tipsList: {
      gap: 12,
    },
    tipText: {
      fontSize: 14,
      color: theme.colors.primary,
      lineHeight: 20,
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
    passwordToggleText: {
      fontSize: 20,
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
      color: theme.colors.warning, // Amber 500
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
    tipText: {
      fontSize: 13,
      color: theme.colors.gray700,
      marginBottom: 4,
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



