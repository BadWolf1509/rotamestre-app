/**
 * Perfil do Motorista - Página de visualização de perfil e métricas
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';

import {
  PerfilHeader,
  PerformanceKPIs,
  RotasRecentes,
  styles,
} from '@/components/gestor/motorista-perfil';
import type { Motorista, MotoristaPerformance, RotaRecente } from '@/components/gestor/motorista-perfil';
import {
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  Dialog,
  SplitView,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { logger } from '@/lib/logger';
import { maskPhone, validatePhone, getPhoneErrorMessage } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { useUnistyles, StyleSheet } from '@/utils/styles';

export default function MotoristaPerfil() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const { userData } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [performance, setPerformance] = useState<MotoristaPerformance | null>(null);
  const [rotasRecentes, setRotasRecentes] = useState<RotaRecente[]>([]);
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [telefoneError, setTelefoneError] = useState('');

  // Get motorista ID from params
  const motoristaId = Array.isArray(id) ? id[0] : id;

  // Page meta
  const pageMeta = {
    title: 'Perfil do Motorista',
    subtitle: motorista?.nome || 'Carregando...',
    breadcrumbs: [
      { label: 'Inicio', href: '/gestor/inicio' },
      { label: 'Motoristas', href: '/gestor/motoristas' },
      { label: 'Perfil' },
    ],
  };

  // Load all data
  const loadData = useCallback(async () => {
    if (!motoristaId) return;

    try {
      // 1. Fetch motorista data
      const { data: motoristaData, error: motoristaError } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, foto_url, ativo, created_at')
        .eq('id', motoristaId)
        .single();

      if (motoristaError) throw motoristaError;
      setMotorista(motoristaData);

      // 2. Fetch performance from view
      const { data: performanceData, error: performanceError } = await supabase
        .from('vw_performance_motoristas')
        .select('*')
        .eq('id', motoristaId)
        .single();

      if (performanceError) {
        // View might not have data for this motorista (no routes yet)
        logger.warn('Performance data not found:', performanceError);
        setPerformance({
          id: motoristaId,
          nome: motoristaData.nome,
          unidade_id: '',
          unidade_nome: '',
          total_rotas: 0,
          rotas_concluidas: 0,
          rotas_em_andamento: 0,
          rotas_nao_executadas: 0,
          rotas_canceladas: 0,
          taxa_execucao: 100,
          distancia_total_km: null,
          tempo_medio_minutos: null,
        });
      } else {
        setPerformance(performanceData);
      }

      // 3. Fetch recent routes
      const { data: rotasData, error: rotasError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total')
        .eq('motorista_id', motoristaId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (rotasError) throw rotasError;
      setRotasRecentes(rotasData || []);

    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      showToast('Não foi possível carregar os dados do motorista', 'error');
    }
  }, [motoristaId, showToast]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    load();
  }, [loadData]);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Toggle active status
  const handleToggleStatus = useCallback(async () => {
    if (!motorista) return;

    try {
      const newStatus = !motorista.ativo;
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo: newStatus, updated_at: new Date().toISOString() })
        .eq('id', motorista.id);

      if (error) throw error;

      setMotorista({ ...motorista, ativo: newStatus });
      showToast(
        `Motorista ${newStatus ? 'ativado' : 'desativado'} com sucesso`,
        'success'
      );
      setShowToggleModal(false);
    } catch (error) {
      logger.error('Erro ao alterar status:', error);
      showToast('Não foi possível alterar o status', 'error');
    }
  }, [motorista, showToast]);

  // Open edit modal
  const handleEdit = useCallback(() => {
    if (!motorista) return;
    setFormNome(motorista.nome);
    setFormEmail(motorista.email);
    setFormTelefone(motorista.telefone || '');
    setTelefoneError('');
    setShowEditModal(true);
  }, [motorista]);

  // Handle phone change with mask
  const handleTelefoneChange = (text: string) => {
    const masked = maskPhone(text);
    setFormTelefone(masked);
    if (masked && !validatePhone(masked)) {
      setTelefoneError(getPhoneErrorMessage(masked) || 'Telefone inválido');
    } else {
      setTelefoneError('');
    }
  };

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!motorista) return;

    // Validate
    if (!formNome.trim()) {
      showToast('Nome é obrigatório', 'error');
      return;
    }

    if (formTelefone && !validatePhone(formTelefone)) {
      setTelefoneError(getPhoneErrorMessage(formTelefone) || 'Telefone inválido');
      return;
    }

    try {
      setSalvando(true);

      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: formNome.trim(),
          telefone: formTelefone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', motorista.id);

      if (error) throw error;

      // Update local state
      setMotorista({
        ...motorista,
        nome: formNome.trim(),
        telefone: formTelefone || undefined,
      });

      showToast('Motorista atualizado com sucesso', 'success');
      setShowEditModal(false);
    } catch (error) {
      logger.error('Erro ao salvar:', error);
      showToast('Não foi possível salvar as alterações', 'error');
    } finally {
      setSalvando(false);
    }
  }, [motorista, formNome, formTelefone, showToast]);

  // Handle view all routes
  const handleVerTodasRotas = useCallback(() => {
    router.push('/gestor/gestao-rotas');
  }, [router]);

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setTelefoneError('');
  };

  // ===== Render Edit Form Content =====
  const renderEditFormContent = () => (
    <View style={editStyles.formContainer}>
      <View style={editStyles.inputGroup}>
        <Text style={editStyles.label}>Nome *</Text>
        <TextInput
          style={[editStyles.input, isDesktop && editStyles.inputCompact]}
          value={formNome}
          onChangeText={setFormNome}
          placeholder="Nome do motorista"
          placeholderTextColor={theme.colors.gray400}
          accessibilityLabel="Campo de nome do motorista"
        />
      </View>

      <View style={editStyles.inputGroup}>
        <Text style={editStyles.label}>Email</Text>
        <TextInput
          style={[editStyles.input, isDesktop && editStyles.inputCompact, editStyles.inputDisabled]}
          value={formEmail}
          editable={false}
          placeholderTextColor={theme.colors.gray400}
          accessibilityLabel="Email do motorista (não editável)"
        />
        <Text style={editStyles.helperText}>Email não pode ser alterado</Text>
      </View>

      <View style={editStyles.inputGroup}>
        <Text style={editStyles.label}>Telefone</Text>
        <TextInput
          style={[editStyles.input, isDesktop && editStyles.inputCompact, telefoneError ? editStyles.inputError : null]}
          value={formTelefone}
          onChangeText={handleTelefoneChange}
          placeholder="(00) 00000-0000"
          placeholderTextColor={theme.colors.gray400}
          keyboardType="phone-pad"
          maxLength={15}
          accessibilityLabel="Campo de telefone do motorista"
        />
        {telefoneError ? (
          <Text style={editStyles.errorText}>{telefoneError}</Text>
        ) : null}
      </View>
    </View>
  );

  // ===== Render States =====

  // Loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  // No ID
  if (!motoristaId) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Nenhum motorista selecionado</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/gestor/motoristas')}
        >
          <Text style={styles.backButtonText}>Voltar para lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Not found
  if (!motorista) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Motorista não encontrado</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push('/gestor/motoristas')}
        >
          <Text style={styles.backButtonText}>Voltar para lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===== Desktop Layout =====
  if (isDesktop) {
    return (
      <DesktopPageLayout
        title={pageMeta.title}
        subtitle={pageMeta.subtitle}
        breadcrumbs={pageMeta.breadcrumbs}
        userMenuTrigger={userMenuTrigger}
        userMenuItems={userMenuItems}
      >
        <View style={styles.contentDesktop}>
          <SplitView
            left={
              <DesktopCard title="Informações" icon="person" noPadding={false}>
                <PerfilHeader
                  motorista={motorista}
                  onEdit={handleEdit}
                  onToggleStatus={() => setShowToggleModal(true)}
                />
              </DesktopCard>
            }
            right={
              <View style={styles.rightColumn}>
                <DesktopCard title="Performance" icon="stats-chart" noPadding={false}>
                  {performance && <PerformanceKPIs performance={performance} />}
                </DesktopCard>

                <DesktopCard title="Rotas Recentes" icon="navigate" noPadding={false}>
                  <RotasRecentes
                    rotas={rotasRecentes}
                    onVerTodas={handleVerTodasRotas}
                  />
                </DesktopCard>
              </View>
            }
            leftFlex={0.8}
            rightFlex={1.2}
            gap={24}
          />
        </View>

        {/* Edit Modal (Desktop) */}
        <DesktopModal
          visible={showEditModal}
          onClose={closeEditModal}
          title="Editar Motorista"
          maxWidth={480}
          primaryButton={{
            text: 'Salvar',
            onPress: handleSaveEdit,
            loading: salvando,
          }}
          secondaryButton={{
            text: 'Cancelar',
            onPress: closeEditModal,
            disabled: salvando,
          }}
        >
          {renderEditFormContent()}
        </DesktopModal>

        {/* Toggle Status Modal */}
        <Dialog
          visible={showToggleModal}
          variant="confirm"
          title={motorista.ativo ? 'Desativar Motorista' : 'Ativar Motorista'}
          message={`Tem certeza que deseja ${motorista.ativo ? 'desativar' : 'ativar'} ${motorista.nome}?`}
          confirmText={motorista.ativo ? 'Desativar' : 'Ativar'}
          cancelText="Cancelar"
          onConfirm={handleToggleStatus}
          onCancel={() => setShowToggleModal(false)}
          type={motorista.ativo ? 'danger' : 'success'}
        />

        {/* Logout Modal */}
        {logoutModal}

        {/* Toast */}
        <Toast {...toast} onDismiss={hideToast} />
      </DesktopPageLayout>
    );
  }

  // ===== Mobile Layout =====
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {/* Header Card */}
          <PerfilHeader
            motorista={motorista}
            onEdit={handleEdit}
            onToggleStatus={() => setShowToggleModal(true)}
          />

          {/* Performance KPIs */}
          {performance && <PerformanceKPIs performance={performance} />}

          {/* Recent Routes */}
          <RotasRecentes
            rotas={rotasRecentes}
            onVerTodas={handleVerTodasRotas}
          />
        </View>
      </ScrollView>

      {/* Edit Modal (Mobile) */}
      <DesktopModal
        visible={showEditModal}
        onClose={closeEditModal}
        title="Editar Motorista"
        maxWidth={480}
        primaryButton={{
          text: 'Salvar',
          onPress: handleSaveEdit,
          loading: salvando,
        }}
        secondaryButton={{
          text: 'Cancelar',
          onPress: closeEditModal,
          disabled: salvando,
        }}
      >
        {renderEditFormContent()}
      </DesktopModal>

      {/* Toggle Status Modal */}
      <Dialog
        visible={showToggleModal}
        variant="confirm"
        title={motorista.ativo ? 'Desativar Motorista' : 'Ativar Motorista'}
        message={`Tem certeza que deseja ${motorista.ativo ? 'desativar' : 'ativar'} ${motorista.nome}?`}
        confirmText={motorista.ativo ? 'Desativar' : 'Ativar'}
        cancelText="Cancelar"
        onConfirm={handleToggleStatus}
        onCancel={() => setShowToggleModal(false)}
        type={motorista.ativo ? 'danger' : 'success'}
      />

      {/* Toast */}
      <Toast {...toast} onDismiss={hideToast} />
    </View>
  );
}

// Edit modal styles
const editStyles = StyleSheet.create((theme) => ({
  formContainer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  inputGroup: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.white,
  },
  inputDisabled: {
    backgroundColor: theme.colors.gray100,
    color: theme.colors.gray500,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  helperText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  errorText: {
    fontSize: theme.typography.xs,
    color: theme.colors.error,
  },
  // Desktop compact styles
  inputCompact: {
    height: theme.desktop.input.height,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
  },
}));
