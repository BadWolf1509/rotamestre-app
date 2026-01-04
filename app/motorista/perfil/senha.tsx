import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, Input, Text } from '@/design-system';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';

export default function AlterarSenha() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  async function handleSave() {
    if (!senhaAtual) {
      Alert.alert('Erro', 'Digite sua senha atual');
      return;
    }

    if (!novaSenha) {
      Alert.alert('Erro', 'Digite a nova senha');
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter no minimo 6 caracteres');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas nao coincidem');
      return;
    }

    if (senhaAtual === novaSenha) {
      Alert.alert('Erro', 'A nova senha deve ser diferente da atual');
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

      Alert.alert('Sucesso!', 'Senha alterada com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      logger.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', error.message || 'Nao foi possivel alterar a senha');
    } finally {
      setSaving(false);
    }
  }

  function validatePassword(password: string): {
    isValid: boolean;
    message: string;
  } {
    if (password.length < 6) {
      return { isValid: false, message: 'Minimo 6 caracteres' };
    }
    if (password.length >= 6 && password.length < 8) {
      return { isValid: true, message: 'Senha fraca' };
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return { isValid: true, message: 'Senha media' };
    }
    return { isValid: true, message: 'Senha forte' };
  }

  const passwordStrength = novaSenha ? validatePassword(novaSenha) : null;
  const passwordsMatch = novaSenha && confirmarSenha && novaSenha === confirmarSenha;

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
                passwordStrength.message === 'Senha forte' &&
                  styles(theme).helperTextSuccess,
                passwordStrength.message === 'Senha media' &&
                  styles(theme).helperTextWarning,
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
            <Text style={styles(theme).tipsTitle}>Dicas para uma senha forte:</Text>
            <Text style={styles(theme).tipText}>- Minimo de 6 caracteres</Text>
            <Text style={styles(theme).tipText}>- Use letras maiusculas e minusculas</Text>
            <Text style={styles(theme).tipText}>- Inclua numeros</Text>
            <Text style={styles(theme).tipText}>
              - Adicione caracteres especiais (@, #, $, etc.)
            </Text>
          </View>

          <View style={styles(theme).buttonsContainer}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={() => router.push('/motorista/perfil')}
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
    </View>
  );
}

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
