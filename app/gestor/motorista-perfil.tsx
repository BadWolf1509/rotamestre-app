/**
 * Perfil do Motorista - Página de visualização de perfil e métricas
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';

import { FieldError } from '@/components/auth/FieldError';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  PerfilHeader,
  PerformanceKPIs,
  RotasRecentes,
  styles,
} from '@/components/gestor/motorista-perfil';
import type {
  Motorista,
  MotoristaPerformance,
  RotaRecente,
} from '@/components/gestor/motorista-perfil';
import { RotasAbertasModal } from '@/components/gestor/motoristas/RotasAbertasModal';
import {
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  Dialog,
  SplitView,
  Toast,
} from '@/design-system';
import { useBloqueioDesativacao } from '@/hooks/motoristas-gestor/useBloqueioDesativacao';
import {
  useFormEditarMotorista,
  valoresEdicaoDe,
} from '@/hooks/motoristas-gestor/useMotoristasForm';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { buscarPerformanceMotorista } from '@/lib/gestor/performanceMotorista';
import { logger } from '@/lib/logger';
import { mensagemRegraDoBanco } from '@/lib/motorista/mensagemRegraDoBanco';
import { maskPhone } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { useUnistyles, StyleSheet } from '@/utils/styles';

export default function MotoristaPerfil() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { bloqueio, mostrarSeBloqueado, fecharBloqueio } =
    useBloqueioDesativacao();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [performance, setPerformance] = useState<MotoristaPerformance | null>(
    null,
  );
  const [rotasRecentes, setRotasRecentes] = useState<RotaRecente[]>([]);
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Edit modal state: o mesmo form de edição da lista (motoristaEdicaoSchema)
  const [showEditModal, setShowEditModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const formEditar = useFormEditarMotorista();
  const { reset: resetEdicao, handleSubmit: submeterEdicao } = formEditar;

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

  // Contador de requisição: a carga depende da loja aberta, e trocar de loja
  // com o perfil aberto dispara outra. Só a mais recente grava; a resposta
  // lenta da loja anterior chegaria depois e sobrescreveria a atual.
  const requisicaoRef = useRef(0);

  // Load all data. Devolve false quando outra carga começou depois desta.
  const loadData = useCallback(async (): Promise<boolean> => {
    const minha = ++requisicaoRef.current;
    const obsoleta = () => minha !== requisicaoRef.current;
    if (!motoristaId) return true;

    try {
      // 1. Fetch motorista data
      const { data: motoristaData, error: motoristaError } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, foto_url, ativo, created_at')
        .eq('id', motoristaId)
        .single();

      if (obsoleta()) return false;
      if (motoristaError) throw motoristaError;
      setMotorista(motoristaData);

      // 2. Performance (view sem linha para motorista inativo → taxa "—")
      const performanceData = await buscarPerformanceMotorista(
        motoristaId,
        motoristaData.nome,
      );
      if (obsoleta()) return false;
      setPerformance(performanceData);

      // 3. Rotas recentes DESTA loja: o motorista que atende outra loja
      // traria as rotas dela, e o toque abriria rota que esta não gerencia.
      // Sem loja aberta, lista vazia (fail-closed).
      const { data: rotasData, error: rotasError } = unidadeAtiva
        ? await supabase
            .from('rotas')
            .select('id, data, status, distancia_total')
            .eq('motorista_id', motoristaId)
            .eq('unidade_id', unidadeAtiva)
            .order('created_at', { ascending: false })
            .limit(10)
        : { data: [], error: null };

      if (obsoleta()) return false;
      if (rotasError) throw rotasError;
      setRotasRecentes(rotasData || []);
      return true;
    } catch (error) {
      if (obsoleta()) return false;
      logger.error('Erro ao carregar dados:', error);
      showToast('Não foi possível carregar os dados do motorista', 'error');
      return true;
    }
  }, [motoristaId, showToast, unidadeAtiva]);

  // Initial load (e de novo na troca de loja). A carga substituída não
  // desliga o spinner da que a substituiu.
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (await loadData()) setLoading(false);
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
      // Mesma porta da lista: quem atende outra loja sai só desta (o vínculo).
      const { data, error } = await supabase.rpc(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: motorista.id,
          p_unidade_id: unidadeAtiva,
          p_ativo: newStatus,
        },
      );

      if (error) throw error;

      setMotorista({ ...motorista, ativo: newStatus });
      showToast(
        data === 'vinculo'
          ? `Motorista ${newStatus ? 'ativado' : 'desativado'} só nesta loja`
          : `Motorista ${newStatus ? 'ativado' : 'desativado'} com sucesso`,
        'success',
      );
      setShowToggleModal(false);
      // Desativado só aqui, a RLS deixa de mostrá-lo: volta para a lista.
      if (data === 'vinculo' && !newStatus) router.back();
    } catch (error) {
      // Rota aberta (Migration 54): troca a confirmação pela lista de rotas.
      if (mostrarSeBloqueado(error, motorista.nome)) {
        setShowToggleModal(false);
        return;
      }
      logger.error('Erro ao alterar status:', error);
      showToast(
        mensagemRegraDoBanco(error) ?? 'Não foi possível alterar o status',
        'error',
      );
    }
  }, [motorista, mostrarSeBloqueado, router, showToast, unidadeAtiva]);

  // Open edit modal (valores e erros do zero a cada abertura)
  const handleEdit = useCallback(() => {
    if (!motorista) return;
    resetEdicao(valoresEdicaoDe(motorista));
    setShowEditModal(true);
  }, [motorista, resetEdicao]);

  // Save edit: o schema valida antes (erro no campo); só o válido grava.
  const handleSaveEdit = useCallback(async () => {
    if (!motorista) return;

    await submeterEdicao(async (valores) => {
      const nome = valores.nome.trim();
      const telefone = valores.telefone?.trim() || null;
      try {
        setSalvando(true);

        const { error } = await supabase
          .from('usuarios')
          .update({
            nome,
            telefone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', motorista.id);

        if (error) throw error;

        // Update local state
        setMotorista({
          ...motorista,
          nome,
          telefone: telefone ?? undefined,
        });

        showToast('Motorista atualizado com sucesso', 'success');
        setShowEditModal(false);
      } catch (error) {
        logger.error('Erro ao salvar:', error);
        showToast('Não foi possível salvar as alterações', 'error');
      } finally {
        setSalvando(false);
      }
    })();
  }, [motorista, showToast, submeterEdicao]);

  // Handle view all routes
  const handleVerTodasRotas = useCallback(() => {
    router.push('/gestor/gestao-rotas');
  }, [router]);

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
  };

  // ===== Render Edit Form Content =====
  const renderEditFormContent = () => (
    <View style={editStyles.formContainer}>
      <Controller
        control={formEditar.control}
        name="nome"
        render={({ field, fieldState }) => (
          <View style={editStyles.inputGroup}>
            <Text style={editStyles.label}>Nome *</Text>
            <TextInput
              style={[
                editStyles.input,
                isDesktop && editStyles.inputCompact,
                fieldState.error ? editStyles.inputError : null,
              ]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Nome do motorista"
              placeholderTextColor={theme.colors.gray400}
              accessibilityLabel="Campo de nome do motorista"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />

      <View style={editStyles.inputGroup}>
        <Text style={editStyles.label}>Email</Text>
        <TextInput
          style={[
            editStyles.input,
            isDesktop && editStyles.inputCompact,
            editStyles.inputDisabled,
          ]}
          value={motorista?.email}
          editable={false}
          placeholderTextColor={theme.colors.gray400}
          accessibilityLabel="Email do motorista (não editável)"
        />
        <Text style={editStyles.helperText}>Email não pode ser alterado</Text>
      </View>

      <Controller
        control={formEditar.control}
        name="telefone"
        render={({ field, fieldState }) => (
          <View style={editStyles.inputGroup}>
            <Text style={editStyles.label}>Telefone</Text>
            <TextInput
              style={[
                editStyles.input,
                isDesktop && editStyles.inputCompact,
                fieldState.error ? editStyles.inputError : null,
              ]}
              value={field.value ?? ''}
              onChangeText={(text) => field.onChange(maskPhone(text))}
              onBlur={field.onBlur}
              placeholder="(00) 00000-0000"
              placeholderTextColor={theme.colors.gray400}
              keyboardType="phone-pad"
              maxLength={15}
              accessibilityLabel="Campo de telefone do motorista"
            />
            <FieldError message={fieldState.error?.message} />
          </View>
        )}
      />
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
      <ErrorBoundary>
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
                <DesktopCard
                  title="Informações"
                  icon="person"
                  noPadding={false}
                >
                  <PerfilHeader
                    motorista={motorista}
                    onEdit={handleEdit}
                    onToggleStatus={() => setShowToggleModal(true)}
                  />
                </DesktopCard>
              }
              right={
                <View style={styles.rightColumn}>
                  <DesktopCard
                    title="Performance"
                    icon="stats-chart"
                    noPadding={false}
                  >
                    {performance && (
                      <PerformanceKPIs performance={performance} />
                    )}
                  </DesktopCard>

                  <DesktopCard
                    title="Rotas Recentes"
                    icon="navigate"
                    noPadding={false}
                  >
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
          <RotasAbertasModal bloqueio={bloqueio} onClose={fecharBloqueio} />

          {/* Logout Modal */}
          {logoutModal}

          {/* Toast */}
          <Toast {...toast} onDismiss={hideToast} />
        </DesktopPageLayout>
      </ErrorBoundary>
    );
  }

  // ===== Mobile Layout =====
  return (
    <ErrorBoundary>
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
        <RotasAbertasModal bloqueio={bloqueio} onClose={fecharBloqueio} />

        {/* Toast */}
        <Toast {...toast} onDismiss={hideToast} />
        {logoutModal}
      </View>
    </ErrorBoundary>
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
  // Desktop compact styles
  inputCompact: {
    height: theme.desktop.input.height,
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
  },
}));
