import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { AlertDialog } from '@/components/AlertDialog';
import { FormDesktopLayout } from '@/components/perfil/FormDesktopLayout';
import { authService } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Usuario } from '@/types/usuario';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useResponsive } from '@/hooks/useResponsive';

export default function EditarPerfilGestor() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Campos editáveis
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
      console.error('Erro ao carregar usuário:', error);
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
    // Validações
    if (!nome.trim()) {
      showAlert({
        title: 'Campo obrigatório',
        message: 'O nome é obrigatório.',
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

      // Atualizar no banco
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
        message: 'Suas informações foram salvas com sucesso.',
        type: 'success',
        confirmText: 'Voltar',
        onConfirm: () => router.replace('/perfil'),
      });
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      showAlert({
        title: 'Erro ao salvar',
        message: error.message || 'Não foi possível salvar as alterações.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  function formatPhone(text: string) {
    // Remove tudo que não é número
    const cleaned = text.replace(/\D/g, '');

    // Aplica a máscara
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

  // Desktop layout
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
        />
        <AlertDialog
          visible={alertConfig.visible}
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

  // Mobile layout
  return (
    <View style={styles(theme).container}>
      <ScrollView style={styles(theme).scrollView}>
        {/* Header */}
        <View style={styles(theme).header}>
          <View style={styles(theme).headerContent}>
            <Text style={styles(theme).headerSubtitle}>
              Atualize suas informações pessoais
            </Text>
          </View>
        </View>

        {/* Formulário */}
        <View style={styles(theme).form}>
          {/* Nome */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>
              Nome Completo <Text style={styles(theme).required}>*</Text>
            </Text>
            <TextInput
              style={styles(theme).input}
              placeholder="Digite seu nome completo"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={100}
            />
          </View>

          {/* Email (não editável) */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>Email</Text>
            <TextInput
              style={[styles(theme).input, styles(theme).inputDisabled]}
              value={usuario?.email || ''}
              editable={false}
            />
            <Text style={styles(theme).helperText}>
              O email não pode ser alterado
            </Text>
          </View>

          {/* Telefone */}
          <View style={styles(theme).inputGroup}>
            <Text style={styles(theme).inputLabel}>Telefone</Text>
            <TextInput
              style={styles(theme).input}
              placeholder="(11) 99999-9999"
              value={telefone}
              onChangeText={(text) => setTelefone(formatPhone(text))}
              keyboardType="phone-pad"
              maxLength={15}
            />
            <Text style={styles(theme).helperText}>
              Formato: (11) 99999-9999
            </Text>
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

      <AlertDialog
        visible={alertConfig.visible}
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.gray50,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.colors.gray500,
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
    input: {
      borderWidth: 1,
      borderColor: theme.colors.gray300,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.gray900,
      backgroundColor: theme.colors.white,
    },
    inputDisabled: {
      backgroundColor: theme.colors.gray100,
      color: theme.colors.gray500,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.gray500,
      marginTop: 4,
    },
    buttonsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
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
