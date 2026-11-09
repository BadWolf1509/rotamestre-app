import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View, RefreshControl } from 'react-native';

import { AvisoErroCarga } from '@/components/gestor/AvisoErroCarga';
import { RouteFilters } from '@/components/RouteFilters';
import type { RouteFiltersState as RouteFiltersType } from '@/components/RouteFilters';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { DesktopPageLayout, EmptyState, Toast } from '@/design-system';
import { useExclusaoDeRota } from '@/hooks/gestao-rotas/useExclusaoDeRota';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useMotoristas } from '@/hooks/useMotoristas';
import { useToast } from '@/hooks/useToast';
import { StyleSheet, type Theme } from '@/utils/styles';

import { ListaDeRotasDoDia } from './ListaDeRotasDoDia';
import { ResumoDoDia } from './ResumoDoDia';

import type { DashboardData } from '../../_hooks/useDashboardData';

/**
 * O que a Início diz sem rota, no vazio e no resumo (a mesma frase nos dois).
 * Sem período a lista é a de hoje; com ele, não se fala em "hoje". Com filtro
 * de status ou motorista, o dia pode ter rota que o filtro esconde: nada de
 * "crie a primeira rota".
 */
function textosDoVazio(filters: RouteFiltersType): {
  titulo: string;
  descricao: string;
} {
  const ajusteOsFiltros = 'Ajuste os filtros ou crie uma nova rota';
  if (filters.dataInicio || filters.dataFim) {
    return { titulo: 'Nenhuma rota no período', descricao: ajusteOsFiltros };
  }
  if (filters.status || filters.motoristaId) {
    return {
      titulo: 'Nenhuma rota hoje com esses filtros',
      descricao: ajusteOsFiltros,
    };
  }
  return {
    titulo: 'Nenhuma rota cadastrada hoje',
    descricao: 'Crie a primeira rota de entrega do dia',
  };
}

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

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // O Toast é da página (useToast é estado por instância); o fluxo de
  // exclusão (diálogo + toasts) é o mesmo da Gestão de Rotas.
  const { toast, showToast, hideToast } = useToast();
  const { pedirExclusao, dialogo } = useExclusaoDeRota({
    showToast,
    usuarioId: userData?.id,
    aoExcluir: onRefresh,
  });

  const handleDeleteRota = useCallback(
    (rotaId: string) => {
      const rota = rotas.find((r) => r.id === rotaId);
      if (rota) pedirExclusao(rota);
    },
    [rotas, pedirExclusao],
  );

  // Memoize view details handler
  const handleViewDetails = useCallback(
    (rotaId: string) => {
      router.push(`/gestor/mapa-rota?id=${rotaId}`);
    },
    [router],
  );

  const vazio = textosDoVazio(filters);

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
            textoSemRotas={vazio.titulo}
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
                title={vazio.titulo}
                description={vazio.descricao}
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

      {dialogo}

      <Toast {...toast} onDismiss={hideToast} />
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
