import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { Button, Input, Text } from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorMapping';
import { logger } from '@/lib/logger';
import { emitProfileUpdate } from '@/lib/profileEvents';
// Mesma regra do perfil do motorista (nome obrigatório, telefone mascarado).
import {
  perfilMotoristaSchema as perfilSchema,
  type PerfilMotoristaInput as PerfilInput,
} from '@/lib/schemas/perfilMotorista';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

/** A RLS recusa UPDATE sem erro: zero linhas. Vira erro, não sucesso. */
class PerfilNaoAlterado extends Error {}

function formatPhone(text: string) {
  const cleaned = text.replace(/\D/g, '');

  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  } else {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  }
}

export default function EditarPerfilGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const { showError, showSuccess, AlertDialog } = useAlert();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<PerfilInput>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { nome: '', telefone: '' },
  });

  const loadUsuario = useCallback(async () => {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        const userData = await authService.getUsuario(session.user.id);
        setUsuario(userData);
        reset({
          nome: userData?.nome || '',
          telefone: userData?.telefone || '',
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar usuário', error);
      showError({
        title: 'Erro ao carregar dados',
        message: 'Não foi possível carregar o seu perfil. Tente novamente.',
        onDismiss: () => router.back(),
      });
      return;
    } finally {
      setLoading(false);
    }
  }, [reset, router, showError]);

  useEffect(() => {
    loadUsuario();
  }, [loadUsuario]);

  // Volta à tela de onde veio (o perfil): `push`/`replace` empilhavam outra
  // tela de perfil, e o "voltar" do aparelho caía no formulário de novo. Sem
  // histórico (link aberto direto no navegador), vai ao perfil.
  const voltar = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/perfil');
  }, [router]);

  const salvar = handleSubmit(async ({ nome, telefone }) => {
    try {
      if (!usuario?.id) throw new Error('Usuário não encontrado');

      const { data: alteradas, error } = await supabase
        .from('usuarios')
        .update({
          nome,
          telefone: telefone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usuario.id)
        .select('id');

      if (error) throw error;
      if ((alteradas?.length ?? 0) === 0) throw new PerfilNaoAlterado();

      // As outras instâncias de useUser (cabeçalho, menu, a da raiz) seguiam
      // com o nome antigo: recarregam todas, numa consulta só.
      emitProfileUpdate();

      showSuccess(
        'Perfil atualizado',
        'Suas informações foram salvas com sucesso.',
        voltar,
      );
    } catch (error: unknown) {
      logger.error('Erro ao salvar perfil', error);
      if (error instanceof PerfilNaoAlterado) {
        showError({
          title: 'Perfil não atualizado',
          message:
            'Não foi possível salvar as alterações. Saia e entre de novo no app e tente outra vez.',
        });
        return;
      }
      // O erro do postgrest-js é objeto simples: o mapeamento traduz o
      // `code`/`message` em frase para o gestor, sem expor o texto cru.
      const { title, message } = getErrorMessage(error);
      showError({ title, message });
    }
  });

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (isDesktop) {
    // O layout de desktop recebe os campos prontos (não aceita Controller):
    // o valor vem do form e a revalidação segue a do Controller (só depois
    // da 1ª tentativa de salvar).
    const fields = [
      {
        label: 'Nome Completo',
        value: watch('nome'),
        placeholder: 'Digite seu nome completo',
        onChange: (text: string) =>
          setValue('nome', text, { shouldValidate: isSubmitted }),
        autoCapitalize: 'words' as const,
        error: errors.nome?.message,
      },
      {
        label: 'Email',
        value: usuario?.email || '',
        editable: false,
        helperText: 'O email não pode ser alterado',
        onChange: () => {},
      },
      {
        label: 'Telefone',
        value: watch('telefone'),
        placeholder: '(11) 99999-9999',
        onChange: (text: string) =>
          setValue('telefone', formatPhone(text), {
            shouldValidate: isSubmitted,
          }),
        keyboardType: 'phone-pad' as const,
        helperText: 'Formato: (11) 99999-9999',
        error: errors.telefone?.message,
      },
    ];

    return (
      <ErrorBoundary>
        <FormDesktopLayout
          title="Editar Perfil"
          subtitle="Atualize suas informações pessoais"
          fields={fields}
          primaryButtonText="Salvar Alterações"
          primaryButtonDisabled={isSubmitting}
          onPrimaryPress={salvar}
          secondaryButtonText="Cancelar"
          onSecondaryPress={voltar}
          loading={isSubmitting}
        />
        {AlertDialog}
      </ErrorBoundary>
    );
  }

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
                Atualize suas informações pessoais
              </Text>
            </View>
          </View>

          <View style={styles(theme).form}>
            <Controller
              control={control}
              name="nome"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Nome Completo"
                  required
                  placeholder="Digite seu nome completo"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={100}
                  error={errors.nome?.message}
                />
              )}
            />

            <Input
              label="Email"
              value={usuario?.email || ''}
              editable={false}
              helperText="O e-mail não pode ser alterado"
            />

            <Controller
              control={control}
              name="telefone"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Telefone"
                  placeholder="(11) 99999-9999"
                  value={value}
                  onChangeText={(text) => onChange(formatPhone(text))}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                  maxLength={15}
                  helperText="Formato: (11) 99999-9999"
                  error={errors.telefone?.message}
                />
              )}
            />

            <View style={styles(theme).buttonsContainer}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={voltar}
                disabled={isSubmitting}
                style={styles(theme).buttonSecondary}
              />

              <Button
                title="Salvar"
                variant="secondary"
                onPress={salvar}
                loading={isSubmitting}
                disabled={isSubmitting}
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray50,
    },
    loadingText: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.gray500,
    },
    header: {
      backgroundColor: theme.colors.white,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.gray200,
      marginBottom: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerContent: {
      flex: 1,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: '700',
      color: theme.colors.gray900,
    },
    form: {
      backgroundColor: theme.colors.white,
      marginHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xxl,
    },
    buttonsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    buttonPrimary: {
      flex: 1,
    },
    buttonSecondary: {
      flex: 1,
    },
  });
