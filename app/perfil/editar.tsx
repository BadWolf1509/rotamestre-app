import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { Button, Dialog, Input, Text } from '@/design-system';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

export default function EditarPerfilGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'default' as 'default' | 'error' | 'success' | 'warning',
    confirmText: 'OK',
    onConfirm: undefined as undefined | (() => void),
  });

  const hideAlert = () =>
    setAlertConfig((prev) => ({
      ...prev,
      visible: false,
    }));

  function showAlert({
    title,
    message,
    type = 'default',
    confirmText = 'OK',
    onConfirm,
  }: {
    title: string;
    message: string;
    type?: 'default' | 'error' | 'success' | 'warning';
    confirmText?: string;
    onConfirm?: () => void;
  }) {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      confirmText,
      onConfirm,
    });
  }

  const loadUsuario = useCallback(async () => {
    try {
      const session = await authService.getSession();
      if (session?.user) {
        const userData = await authService.getUsuario(session.user.id);
        setUsuario(userData);
        setNome(userData?.nome || '');
        setTelefone(userData?.telefone || '');
      }
    } catch (error) {
      logger.error('Erro ao carregar usuário', error);
      showAlert({
        title: 'Erro ao carregar dados',
        message: 'Não foi possível carregar o seu perfil. Tente novamente.',
        type: 'error',
        onConfirm: () => router.back(),
      });
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUsuario();
  }, [loadUsuario]);

  async function handleSave() {
    if (!nome.trim()) {
      showAlert({
        title: 'Campo obrigatorio',
        message: 'O nome e obrigatorio.',
        type: 'error',
      });
      return;
    }

    if (telefone && !/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(telefone)) {
      showAlert({
        title: 'Telefone inválido',
        message: 'Use o formato (11) 99999-9999.',
        type: 'error',
      });
      return;
    }

    setSaving(true);

    try {
      if (!usuario?.id) throw new Error('Usuário não encontrado');

      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usuario.id);

      if (error) throw error;

      showAlert({
        title: 'Perfil atualizado',
        message: 'Suas informacoes foram salvas com sucesso.',
        type: 'success',
        confirmText: 'Voltar',
        onConfirm: () => router.replace('/perfil'),
      });
    } catch (error: unknown) {
      logger.error('Erro ao salvar perfil', error);
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as alterações.';
      showAlert({
        title: 'Erro ao salvar',
        message,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (isDesktop) {
    const fields = [
      {
        label: 'Nome Completo',
        value: nome,
        placeholder: 'Digite seu nome completo',
        onChange: setNome,
        autoCapitalize: 'words' as const,
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
        value: telefone,
        placeholder: '(11) 99999-9999',
        onChange: (text: string) => setTelefone(formatPhone(text)),
        keyboardType: 'phone-pad' as const,
        helperText: 'Formato: (11) 99999-9999',
      },
    ];

    return (
      <>
        <FormDesktopLayout
          title="Editar Perfil"
          subtitle="Atualize suas informações pessoais"
          fields={fields}
          primaryButtonText="Salvar Alterações"
          primaryButtonDisabled={saving || !nome.trim()}
          onPrimaryPress={handleSave}
          secondaryButtonText="Cancelar"
          onSecondaryPress={() => router.push('/perfil')}
          loading={saving}
          backPath="/perfil"
        />
        <Dialog
          visible={alertConfig.visible}
          variant="alert"
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          confirmText={alertConfig.confirmText}
          onConfirm={() => {
            hideAlert();
            alertConfig.onConfirm?.();
          }}
        />
      </>
    );
  }

  return (
    <ErrorBoundary>
    <View style={styles(theme).container}>
      <ScrollView
        style={styles(theme).scrollView}
        contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom + 20) }}
      >
        <View style={styles(theme).header}>
          <View style={styles(theme).headerContent}>
            <Text style={styles(theme).headerSubtitle}>
              Atualize suas informacoes pessoais
            </Text>
          </View>
        </View>

        <View style={styles(theme).form}>
          <Input
            label="Nome Completo"
            required
            placeholder="Digite seu nome completo"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={100}
          />

          <Input
            label="Email"
            value={usuario?.email || ''}
            editable={false}
            helperText="O email nao pode ser alterado"
          />

          <Input
            label="Telefone"
            placeholder="(11) 99999-9999"
            value={telefone}
            onChangeText={(text) => setTelefone(formatPhone(text))}
            keyboardType="phone-pad"
            maxLength={15}
            helperText="Formato: (11) 99999-9999"
          />

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
              disabled={saving || !nome.trim()}
              style={styles(theme).buttonPrimary}
            />
          </View>
        </View>
      </ScrollView>

      <Dialog
        visible={alertConfig.visible}
        variant="alert"
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        confirmText={alertConfig.confirmText}
        onConfirm={() => {
          hideAlert();
          alertConfig.onConfirm?.();
        }}
      />
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
