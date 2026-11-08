import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View, RefreshControl } from 'react-native';

import { AvisoErroCarga } from '@/components/gestor/AvisoErroCarga';
import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { DesktopPageLayout, Dialog, EmptyState, Toast } from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useMotoristas } from '@/hooks/useMotoristas';
import {
  excluirRota,
  ExclusaoRotaError,
  MENSAGEM_ROTA_EM_ANDAMENTO,
  textoConfirmacaoExclusao,
} from '@/lib/gestor/excluirRota';
import { logger } from '@/lib/logger';
import { StyleSheet, type Theme } from '@/utils/styles';

import { ListaDeRotasDoDia } from './ListaDeRotasDoDia';
import { ResumoDoDia } from './ResumoDoDia';

import type { DashboardData } from '../../_hooks/useDashboardData';

interface DashboardDesktopProps extends DashboardData {
  /** Nome da loja ATIVA (seletor), não a do perfil. */
  unidadeNome?: string | null;
  filters: RouteFiltersType;
  onFiltersChange: (filters: RouteFiltersType) => void;
}

/**
 * Layout desktop do Dashboard do Gestor
 * Sidebar gerenciada pelo gestor/_layout.tsx (persistente entre navegações)
 */
export function DashboardDesktop({
  stats,
  rotas,
  loading,
  refreshing,
  erroCarga,
  dadosDe,
  onRefresh,
  unidadeNome,
  userData, // Receber userData como prop ao invés de usar useUser
  filters,
  onFiltersChange,
}: DashboardDesktopProps) {
  const router = useRouter();

  const pageMeta = getGestorPageMeta('inicio');

  // ✅ Usar hook com cache para motoristas (evita recarregar a cada navegação)
  const { motoristas } = useMotoristas();

  // Estado para modal de confirmação
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rotaToDelete, setRotaToDelete] = useState<string | null>(null);

  // Estado para toast de feedback
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    message: '',
    type: 'info',
  });

  // Memoize showToast para evitar recriação
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info') => {
      setToast({ visible: true, message, type });
    },
    [],
  );

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // Rota escolhida para excluir (o status vem da lista; `excluirRota`
  // reconsulta antes de apagar).
  const rotaParaExcluir = rotaToDelete
    ? rotas.find((r) => r.id === rotaToDelete)
    : undefined;
  const confirmacao = textoConfirmacaoExclusao({
    status: rotaParaExcluir?.status,
    motoristaNome: rotaParaExcluir?.motorista_nome,
    paradasCount: rotaParaExcluir?.total_paradas,
  });

  // Memoize delete handler para evitar re-render da lista de rotas
  const handleDeleteRota = useCallback(
    (rotaId: string) => {
      const rota = rotas.find((r) => r.id === rotaId);
      // Atalho de UX: a lista já sabe que está em andamento. `excluirRota`
      // reconsulta o status; a trava no banco é o gatilho da Migration 41.
      if (rota?.status === 'em_andamento') {
        showToast(MENSAGEM_ROTA_EM_ANDAMENTO, 'error');
        return;
      }
      setRotaToDelete(rotaId);
      setShowConfirmModal(true);
    },
    [rotas, showToast],
  );

  // Memoize execute delete
  const executeDelete = useCallback(
    async (rotaId: string) => {
      if (!userData?.id) {
        showToast('Erro de autenticação. Faça login novamente.', 'error');
        return;
      }
      const rota = rotas.find((r) => r.id === rotaId);
      try {
        await excluirRota({
          rotaId,
          usuarioId: userData.id,
          motoristaNome: rota?.motorista_nome,
          paradasCount: rota?.total_paradas,
        });

        showToast('Rota excluída com sucesso', 'success');
        onRefresh();
      } catch (error) {
        if (error instanceof ExclusaoRotaError) {
          showToast(error.message, 'error');
          onRefresh();
          return;
        }
        logger.error('Erro ao excluir rota:', error);
        showToast('Erro ao excluir a rota', 'error');
      }
    },
    [showToast, onRefresh, rotas, userData?.id],
  );

  // Memoize confirm handler
  const handleConfirmDelete = useCallback(() => {
    setShowConfirmModal(false);
    if (rotaToDelete) {
      executeDelete(rotaToDelete);
      setRotaToDelete(null);
    }
  }, [rotaToDelete, executeDelete]);

  // Memoize cancel handler
  const handleCancelDelete = useCallback(() => {
    setShowConfirmModal(false);
    setRotaToDelete(null);
  }, []);

  // Memoize view details handler
  const handleViewDetails = useCallback(
    (rotaId: string) => {
      router.push(`/gestor/mapa-rota?id=${rotaId}`);
    },
    [router],
  );

  // Sem período escolhido, a Início mostra as rotas de hoje; com ele, o
  // vazio não pode dizer "hoje".
  const comFiltroDePeriodo = Boolean(filters.dataInicio || filters.dataFim);

  const irParaNovaRota = useCallback(() => {
    router.push('/gestor/nova-entrega');
  }, [router]);

  const abrirIncidentes = useCallback(() => {
    router.push('/gestor/incidentes');
  }, [router]);

  const acoesDoCabecalho = useMemo(
    () => [
      {
        label: 'Nova rota',
        icon: 'add',
        variant: 'primary',
        onPress: irParaNovaRota,
      },
    ],
    [irParaNovaRota],
  );

  // Memoize toast dismiss
  const handleToastDismiss = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <>
      <DesktopPageLayout
        title={pageMeta.title}
        subtitle={unidadeNome || pageMeta.subtitle}
        breadcrumbs={pageMeta.breadcrumbs}
        actions={acoesDoCabecalho}
        userMenuTrigger={userMenuTrigger}
        userMenuItems={userMenuItems}
        loading={loading}
        scrollViewProps={{
          refreshControl: (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ),
        }}
      >
        <View style={styles.content}>
          {erroCarga ? (
            <AvisoErroCarga
              mensagem={erroCarga}
              dadosDe={dadosDe}
              onTentarNovamente={onRefresh}
            />
          ) : null}

          <ResumoDoDia
            rotas={rotas}
            incidentesAbertos={stats.incidentesAbertos ?? null}
            onAbrirIncidentes={abrirIncidentes}
          />

          <View style={styles.filtersSection}>
            <RouteFilters
              filters={filters}
              onFiltersChange={onFiltersChange}
              motoristas={motoristas}
              variant="desktop"
            />
          </View>

          {rotas.length === 0 ? (
            <View testID="rotas-table">
              <EmptyState
                icon="map-outline"
                title={
                  comFiltroDePeriodo
                    ? 'Nenhuma rota no período'
                    : 'Nenhuma rota cadastrada hoje'
                }
                description={
                  comFiltroDePeriodo
                    ? 'Ajuste os filtros ou crie uma nova rota'
                    : 'Crie a primeira rota de entrega do dia'
                }
                actionLabel="Criar rota"
                onActionPress={irParaNovaRota}
                compact
                style={styles.emptyState}
              />
            </View>
          ) : (
            <ListaDeRotasDoDia
              rotas={rotas}
              onAbrirRota={handleViewDetails}
              onExcluirRota={handleDeleteRota}
            />
          )}
        </View>
      </DesktopPageLayout>

      <Dialog
        visible={showConfirmModal}
        variant="confirm"
        title={confirmacao.titulo}
        message={confirmacao.mensagem}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={handleToastDismiss}
      />
      {logoutModal}
    </>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  filtersSection: {
    marginBottom: theme.spacing.lg,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
}));
