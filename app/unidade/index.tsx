import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DesktopPageLayout,
  MobileCard,
  MobileLoading,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { boxShadow } from '@/utils/color';
import { cleanPhone, formatPhone } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface UnidadeData {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
}

const formatCnpj = (value?: string | null): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) {
    return value;
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export default function UnidadeScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { userData, loading: userLoading } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('minhaUnidade');
  const [unidade, setUnidade] = useState<UnidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [membrosCount, setMembrosCount] = useState(0);

  // Form state
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const isDesktopView = isDesktop;
  const isLoading = userLoading || loading;

  const loadUnidade = useCallback(async () => {
    const unidadeId = userData?.unidade_id;
    if (!unidadeId) {
      setUnidade(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .eq('id', unidadeId)
        .single();

      if (error) throw error;

      setUnidade(data);
      setNome(data.nome || '');
      setTelefone(formatPhone(data.telefone || ''));
      setEndereco(data.endereco || '');
      setCidade(data.cidade || '');
      setEstado(data.uf || '');
      setCep(data.cep || '');
    } catch (error) {
      console.error('Erro ao carregar unidade:', error);
      showToast('Erro ao carregar dados da unidade', 'error', 4000);
    } finally {
      setLoading(false);
    }
  }, [showToast, userData?.unidade_id]);

  const loadMembrosCount = useCallback(async () => {
    const unidadeId = userData?.unidade_id;
    if (!unidadeId) {
      setMembrosCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true })
        .eq('unidade_id', unidadeId);

      if (error) throw error;
      setMembrosCount(count || 0);
    } catch (error) {
      console.error('Erro ao contar membros:', error);
    }
  }, [userData?.unidade_id]);

  useEffect(() => {
    loadUnidade();
    loadMembrosCount();
  }, [loadMembrosCount, loadUnidade]);

  async function handleSave() {
    if (!nome.trim()) {
      Alert.alert('Erro', 'O nome da unidade é obrigatório');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('unidades')
        .update({
          nome: nome.trim(),
        telefone: cleanPhone(telefone),
          endereco: endereco.trim(),
          cidade: cidade.trim(),
          uf: estado.trim(),
          cep: cep.trim(),
        })
        .eq('id', unidade!.id);

      if (error) throw error;

      showToast('Dados atualizados com sucesso!', 'success', 3000);
      setEditMode(false);
      await loadUnidade();
    } catch (error) {
      console.error('Erro ao atualizar unidade:', error);
      showToast('Erro ao atualizar dados', 'error', 4000);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setNome(unidade?.nome || '');
    setTelefone(formatPhone(unidade?.telefone || ''));
    setEndereco(unidade?.endereco || '');
    setCidade(unidade?.cidade || '');
    setEstado(unidade?.uf || '');
    setCep(unidade?.cep || '');
    setEditMode(false);
  }

  const isGestorPrincipal = userData?.is_gestor_principal === true;

  // Componente Sidebar (Info Cards) - reutilizável
  const SidebarInfo = () => (
    <View style={styles.sidebarContainer}>
      {/* Badge Gestor Principal */}
      {isGestorPrincipal && (
        <View style={styles.principalBadge}>
          <Text style={styles.principalBadgeText}>⭐ Gestor Principal</Text>
        </View>
      )}

      {/* Info Card - Membros */}
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Membros da Equipe</Text>
        <Text style={styles.infoValue}>{membrosCount}</Text>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/unidade/equipe')}
        >
          <Text style={styles.linkButtonText}>
            Ver equipe {'>'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Componente Formulário - reutilizável
  const FormularioUnidade = () => (
    <View style={styles.formContainer}>
      <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações da Unidade</Text>

          {/* Nome */}
          <View style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}>
            <Text style={styles.inputLabel}>Nome da Unidade</Text>
            <TextInput
              style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
              value={nome}
              onChangeText={setNome}
              editable={editMode}
              placeholder="Nome da unidade"
            />
          </View>

          {/* CNPJ (sempre bloqueado) */}
          <View style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}>
            <Text style={styles.inputLabel}>CNPJ</Text>
          <TextInput
            style={[styles.input, isDesktopView && styles.inputDesktop, styles.inputDisabled]}
            value={formatCnpj(unidade?.cnpj)}
            editable={false}
            placeholder="Não informado"
          />
        </View>

          {/* Telefone */}
          <View style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}>
            <Text style={styles.inputLabel}>Telefone</Text>
            <TextInput
              style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
              value={telefone}
              onChangeText={(text) => setTelefone(formatPhone(text))}
              editable={editMode}
              placeholder="(00) 00000-0000"
              keyboardType="phone-pad"
            />
          </View>

          {/* Endereço */}
          <View style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}>
            <Text style={styles.inputLabel}>Endereço</Text>
            <TextInput
              style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
              value={endereco}
              onChangeText={setEndereco}
              editable={editMode}
              placeholder="Rua, número, complemento"
            />
          </View>

          {/* Cidade e Estado */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex2, isDesktopView && styles.inputGroupDesktop]}>
              <Text style={styles.inputLabel}>Cidade</Text>
              <TextInput
                style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
                value={cidade}
                onChangeText={setCidade}
                editable={editMode}
                placeholder="Cidade"
              />
            </View>

            <View style={[styles.inputGroup, styles.flex1, isDesktopView && styles.inputGroupDesktop]}>
              <Text style={styles.inputLabel}>UF</Text>
              <TextInput
                style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
                value={estado}
                onChangeText={setEstado}
                editable={editMode}
                placeholder="UF"
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* CEP */}
          <View style={[styles.inputGroup, isDesktopView && styles.inputGroupDesktop]}>
            <Text style={styles.inputLabel}>CEP</Text>
            <TextInput
              style={[styles.input, isDesktopView && styles.inputDesktop, !editMode && styles.inputDisabled]}
              value={cep}
              onChangeText={setCep}
              editable={editMode}
              placeholder="00000-000"
              keyboardType="numeric"
            />
          </View>

          {/* Botões de Ação (apenas em modo edição) */}
          {editMode && !isDesktopView && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
    </View>
  );

  if (isDesktopView) {
    const desktopActions = isGestorPrincipal
      ? (editMode
          ? [
              {
                label: 'Cancelar',
                icon: 'close-circle-outline',
                onPress: handleCancel,
                variant: 'secondary',
                disabled: saving,
              },
              {
                label: saving ? 'Salvando...' : 'Salvar alterações',
                icon: 'save-outline',
                onPress: handleSave,
                disabled: saving,
              },
            ]
          : [
              {
                label: 'Editar informações',
                icon: 'create-outline',
                onPress: () => setEditMode(true),
              },
            ])
      : undefined;

    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle="Informações e Configurações"
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoading}
          actions={desktopActions}
        >
          <View style={styles.twoColumnLayout}>
            <View style={styles.mainColumn}>
              <FormularioUnidade />
            </View>
            <View style={styles.sideColumn}>
              <SidebarInfo />
            </View>
          </View>
        </DesktopPageLayout>
        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <MobileLoading message="Carregando..." />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {isGestorPrincipal && !editMode && (
            <View style={styles.mobileEditButtonContainer}>
              <TouchableOpacity
                style={styles.mobileEditButton}
                onPress={() => setEditMode(true)}
              >
                <Text style={styles.mobileEditButtonText}>✏️ Editar Informações</Text>
              </TouchableOpacity>
            </View>
          )}
          <MobileCard title="Equipe" variant="bordered">
            <SidebarInfo />
          </MobileCard>
          <MobileCard title="Informações da Unidade" variant="bordered">
            <FormularioUnidade />
          </MobileCard>
        </View>
      </ScrollView>

      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  mobileEditButtonContainer: {
    marginBottom: theme.spacing.lg,
  },
  mobileEditButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  mobileEditButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two-column layout (Desktop)
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
    alignItems: 'flex-start',
  },
  mainColumn: {
    flex: 2,
    minWidth: 0,
  },
  sideColumn: {
    flex: 1,
    minWidth: 0,
  },
  sidebarContainer: {
    // Sidebar container
  },
  formContainer: {
    // Form container
  },
  principalBadge: {
    backgroundColor: theme.colors.warning + '20',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing['2xl'],
    alignItems: 'center',
  },
  principalBadgeText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.warning,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing['2xl'],
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: 'center',
    // Web-only: Smooth transitions and hover
    ...(Platform.OS === 'web' && {
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        borderColor: theme.colors.primary,
        boxShadow: boxShadow(0, 4, 12, 0, theme.colors.black, 0.08),
        transform: 'translateY(-2px)',
      },
    }),
  },
  infoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  infoValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 12,
  },
  linkButton: {
    paddingVertical: 8,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  section: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing['2xl'],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing['2xl'],
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputGroupDesktop: {
    marginBottom: theme.desktop.field.marginBottom,
  },
  inputLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    backgroundColor: theme.colors.white,
    color: theme.colors.gray900,
    minHeight: 48,
  },
  inputDesktop: {
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
    minHeight: theme.desktop.input.height,
  },
  inputDisabled: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.gray500,
  },
  helperText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing['3xl'],
  },
  button: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: theme.colors.secondary,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.white,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
  },
  buttonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  buttonTextSecondary: {
    color: theme.colors.gray900,
  },
}));



