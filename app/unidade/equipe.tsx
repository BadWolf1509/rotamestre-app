import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RotasAbertasModal } from '@/components/gestor/motoristas/RotasAbertasModal';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DesktopPageLayout,
  Button,
  Input,
  MobileCard,
  MobileLoading,
  Text,
  Toast,
} from '@/design-system';
import { useBloqueioDesativacao } from '@/hooks/motoristas-gestor/useBloqueioDesativacao';
import { useAlert } from '@/hooks/useAlert';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import {
  carregarEquipeDaLoja,
  ehGestorPrincipalDaLoja,
  resumoDaEquipe,
  type MembroDaEquipe,
} from '@/lib/gestor/equipeDaLoja';
import { logger } from '@/lib/logger';
import { mensagemRegraDoBanco } from '@/lib/motorista/mensagemRegraDoBanco';
import { supabase } from '@/lib/supabase';
import { StyleSheet, type Theme } from '@/utils/styles';

type Membro = MembroDaEquipe;

export default function EquipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userData, loading: userLoading } = useUser();
  // A loja ABERTA (como no resto do app), não o `usuarios.unidade_id`
  // legado — gestor de várias lojas via a equipe de outra.
  const { unidadeAtiva } = useUnidadeAtiva();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { showWarning, showConfirm, AlertDialog } = useAlert();
  const { bloqueio, mostrarSeBloqueado, fecharBloqueio } =
    useBloqueioDesativacao();
  const { isDesktop } = useResponsive();
  const pageMeta = getGestorPageMeta('equipe');
  const [membros, setMembros] = useState<Membro[]>([]);
  const [filteredMembros, setFilteredMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPapel, setFilterPapel] = useState<
    'todos' | 'gestor' | 'motorista'
  >('todos');
  const isDesktopView = isDesktop;
  const isLoading = userLoading || loading;
  // `loading` troca a tela inteira pelo spinner (MobileLoading no mobile,
  // DesktopPageLayout no desktop). Por isso ele vale só para a carga inicial:
  // a recarga depois de ativar/desativar um membro precisa manter a lista na
  // tela — o gestor acabou de agir e já recebeu o toast de sucesso. Mesma regra
  // do useDashboardData.
  const cargaInicialFeitaRef = useRef(false);
  // Loja da última carga iniciada: trocar de loja é carga inicial de novo
  // (spinner e lista vazia), não recarga — senão a equipe da loja anterior
  // ficaria na tela sob o nome da nova até a resposta chegar.
  const lojaDaCargaRef = useRef<string | null>(null);
  // Contador de requisição: só a carga mais recente grava. Na troca de loja
  // (ou numa recarga), a resposta lenta da anterior chegaria depois e
  // sobrescreveria a atual.
  const requisicaoRef = useRef(0);

  const loadMembros = useCallback(async () => {
    const minhaRequisicao = ++requisicaoRef.current;
    const unidadeId = unidadeAtiva;
    if (!unidadeId) {
      lojaDaCargaRef.current = null;
      setMembros([]);
      setLoading(false);
      return;
    }

    if (lojaDaCargaRef.current !== unidadeId) {
      lojaDaCargaRef.current = unidadeId;
      cargaInicialFeitaRef.current = false;
      setMembros([]);
    }

    try {
      if (!cargaInicialFeitaRef.current) {
        setLoading(true);
      }
      // Mesma fonte da tela Motoristas e do número da Minha Unidade
      // (`carregarEquipeDaLoja`): o vínculo com a loja, não
      // `usuarios.unidade_id`.
      const equipe = await carregarEquipeDaLoja(unidadeId);
      if (minhaRequisicao !== requisicaoRef.current) return;
      setMembros(equipe);
    } catch (error) {
      if (minhaRequisicao !== requisicaoRef.current) return;
      logger.error('Erro ao carregar membros', error);
      showToast('Erro ao carregar equipe', 'error', 4000);
    } finally {
      if (minhaRequisicao === requisicaoRef.current) {
        // A tentativa aconteceu: da próxima vez é recarga, não carga inicial.
        cargaInicialFeitaRef.current = true;
        setLoading(false);
      }
    }
  }, [showToast, unidadeAtiva]);

  useEffect(() => {
    loadMembros();
  }, [loadMembros]);

  useEffect(() => {
    const filtered = membros.filter((m) => {
      const papelOk = filterPapel === 'todos' || m.papel === filterPapel;
      if (!papelOk) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const query = searchQuery.toLowerCase();
      return (
        m.nome.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
      );
    });
    setFilteredMembros(filtered);
  }, [filterPapel, membros, searchQuery]);

  async function handleToggleAtivo(membro: Membro) {
    // Não permitir desativar o próprio usuário
    if (membro.id === userData?.id) {
      showWarning('Erro', 'Você não pode desativar sua própria conta.');
      return;
    }

    // Gestor não se desativa por aqui: a RLS de `usuarios` só deixa o gestor
    // alterar a si mesmo e motoristas, e recusava em silêncio (0 linhas) — a
    // tela dizia "sucesso". A ação nem aparece para gestor; isto é a trava.
    if (membro.papel !== 'motorista') {
      showWarning(
        'Ação indisponível',
        'Gestores só podem ser desativados pelo suporte.',
      );
      return;
    }

    const action = membro.ativo ? 'desativar' : 'reativar';
    const confirmed = await showConfirm({
      title: `Confirmar ${action}`,
      message: `Deseja ${action} o usuário ${membro.nome}?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: membro.ativo ? 'danger' : 'default',
    });

    if (!confirmed) return;

    try {
      // Motorista que atende outra loja sai só desta (o vínculo); o banco
      // decide e recusa mexer na pessoa por aqui.
      const { data, error } = await supabase.rpc(
        'alternar_motorista_na_unidade',
        {
          p_motorista_id: membro.id,
          p_unidade_id: unidadeAtiva,
          p_ativo: !membro.ativo,
        },
      );
      if (error) throw error;
      const soNestaLoja = data === 'vinculo';

      showToast(
        soNestaLoja
          ? `Motorista ${membro.ativo ? 'desativado' : 'reativado'} só nesta loja: ele também atende outra.`
          : `Usuário ${membro.ativo ? 'desativado' : 'reativado'} com sucesso!`,
        'success',
        3000,
      );
      await loadMembros();
    } catch (error) {
      // Rota aberta (Migration 54): mostra as rotas para reatribuir/cancelar.
      if (mostrarSeBloqueado(error, membro.nome)) return;
      logger.error('Erro ao atualizar usuário', error);
      showToast(
        mensagemRegraDoBanco(error) ?? 'Erro ao atualizar usuário',
        'error',
        4000,
      );
    }
  }

  function getPapelLabel(papel: string): string {
    return papel === 'gestor' ? 'Gestor' : 'Motorista';
  }

  // Principal DESTA loja, não o flag global (ver `ehGestorPrincipalDaLoja`).
  const isGestorPrincipal = ehGestorPrincipalDaLoja(userData, unidadeAtiva);
  const { ativos, inativos } = resumoDaEquipe(membros);

  const statsSection = (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{membros.length}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, styles.statValuePositive]}>
          {ativos}
        </Text>
        <Text style={styles.statLabel}>Ativos</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, styles.statValueNegative]}>
          {inativos}
        </Text>
        <Text style={styles.statLabel}>Inativos</Text>
      </View>
    </View>
  );

  const searchSection = (
    <View style={styles.searchSection}>
      <Input
        placeholder="Buscar por nome ou e-mail..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        size={isDesktopView ? 'small' : 'medium'}
        containerStyle={styles.searchInputContainer}
      />
    </View>
  );

  const filterSection = (
    <View style={styles.filterSection}>
      <Button
        title="Todos"
        variant={filterPapel === 'todos' ? 'primary' : 'outline'}
        onPress={() => setFilterPapel('todos')}
        style={styles.filterButton}
        size={isDesktopView ? 'small' : 'medium'}
      />
      <Button
        title="Gestores"
        variant={filterPapel === 'gestor' ? 'primary' : 'outline'}
        onPress={() => setFilterPapel('gestor')}
        style={styles.filterButton}
        size={isDesktopView ? 'small' : 'medium'}
      />
      <Button
        title="Motoristas"
        variant={filterPapel === 'motorista' ? 'primary' : 'outline'}
        onPress={() => setFilterPapel('motorista')}
        style={styles.filterButton}
        size={isDesktopView ? 'small' : 'medium'}
      />
    </View>
  );

  const renderMembersSection = (useDesktopLayout: boolean) => {
    if (filteredMembros.length === 0) {
      const emptyState = (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery
              ? 'Nenhum membro encontrado'
              : 'Nenhum membro na equipe'}
          </Text>
        </View>
      );

      return useDesktopLayout ? (
        <View style={styles.listContainer}>{emptyState}</View>
      ) : (
        <ScrollView style={styles.listContainer}>{emptyState}</ScrollView>
      );
    }

    const cards = (
      <View style={useDesktopLayout ? styles.gridContainer : undefined}>
        {filteredMembros.map((membro) => {
          const isGestorRole = membro.papel === 'gestor';
          return (
            <View
              key={membro.id}
              style={[
                styles.membroCard,
                !membro.ativo && styles.membroCardInativo,
                useDesktopLayout && styles.membroCardGrid,
              ]}
            >
              <View style={styles.membroHeader}>
                <Avatar
                  name={membro.nome}
                  imageUrl={membro.foto_url}
                  size="md"
                />
                <View style={styles.membroInfo}>
                  <View style={styles.membroNameRow}>
                    <Text style={styles.membroNome}>{membro.nome}</Text>
                    {membro.is_gestor_principal && (
                      <View style={styles.principalBadge}>
                        <Text style={styles.principalBadgeText}>⭐</Text>
                      </View>
                    )}
                    {!membro.ativo && (
                      <View style={styles.inativoBadge}>
                        <Text style={styles.inativoBadgeText}>Inativo</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.membroEmail}>{membro.email}</Text>
                  <View
                    style={[
                      styles.papelBadge,
                      isGestorRole
                        ? styles.papelBadgeGestor
                        : styles.papelBadgeMotorista,
                    ]}
                  >
                    <Text
                      style={[
                        styles.papelBadgeText,
                        isGestorRole
                          ? styles.papelBadgeTextGestor
                          : styles.papelBadgeTextMotorista,
                      ]}
                    >
                      {getPapelLabel(membro.papel)}
                    </Text>
                  </View>
                </View>
              </View>

              {isGestorPrincipal &&
                membro.id !== userData?.id &&
                membro.papel === 'motorista' && (
                  <View style={styles.membroActions}>
                    <Button
                      title={membro.ativo ? 'Desativar' : 'Reativar'}
                      variant={membro.ativo ? 'danger' : 'secondary'}
                      onPress={() => handleToggleAtivo(membro)}
                      style={styles.actionButton}
                      size="small"
                    />
                  </View>
                )}

              {membro.id === userData?.id && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>Você</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );

    return useDesktopLayout ? (
      <View style={styles.listContainer}>{cards}</View>
    ) : (
      <ScrollView style={styles.listContainer}>{cards}</ScrollView>
    );
  };

  const footerSection =
    isGestorPrincipal && !isDesktopView ? (
      <View style={styles.footer}>
        <Button
          title="Transferir Gestao Principal"
          variant="outline"
          onPress={() => router.push('/unidade/transferir')}
          style={styles.transferButton}
        />
      </View>
    ) : null;

  if (isDesktopView) {
    const desktopActions = isGestorPrincipal
      ? [
          {
            label: 'Transferir gestão',
            icon: 'swap-horizontal-outline',
            onPress: () => router.push('/unidade/transferir'),
            variant: 'secondary',
          },
        ]
      : undefined;

    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={`${membros.length} ${membros.length === 1 ? 'membro' : 'membros'}`}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoading}
          actions={desktopActions}
        >
          {statsSection}
          {searchSection}
          {filterSection}
          {renderMembersSection(true)}
        </DesktopPageLayout>
        <Toast {...toastState} onDismiss={hideToast} />
        {AlertDialog}
        <RotasAbertasModal bloqueio={bloqueio} onClose={fecharBloqueio} />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <ErrorBoundary>
        <MobileLoading message="Carregando equipe..." />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        <View style={styles.content}>
          <MobileCard title="Resumo" variant="bordered">
            {statsSection}
          </MobileCard>
          <MobileCard title="Filtros" variant="bordered">
            {searchSection}
            {filterSection}
          </MobileCard>
          <MobileCard
            title="Membros"
            subtitle={`${filteredMembros.length} encontrado(s)`}
            variant="bordered"
          >
            {renderMembersSection(false)}
          </MobileCard>
        </View>
        {footerSection}
      </ScrollView>
      <Toast {...toastState} onDismiss={hideToast} />
      {AlertDialog}
      <RotasAbertasModal bloqueio={bloqueio} onClose={fecharBloqueio} />
      {logoutModal}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  loadingText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statValuePositive: {
    color: theme.colors.success,
  },
  statValueNegative: {
    color: theme.colors.error,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
  },
  searchSection: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  searchInputContainer: {
    marginBottom: 0,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  filterButton: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  // Grid layout for desktop
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  emptyState: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing['3xl'],
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
  },
  membroCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    // Elevated card (design system token)
    ...theme.shadows.md,
  },
  membroCardGrid: {
    // 3 colunas no desktop using flexBasis for RN compatibility
    // gap é handled by gridContainer
    flexBasis: '31%' as const,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 280,
    marginBottom: 0, // Gap já gerencia espaçamento
  },
  membroCardInativo: {
    opacity: 0.6,
  },
  membroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  membroInfo: {
    flex: 1,
  },
  membroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  membroNome: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.text,
  },
  principalBadge: {
    backgroundColor: theme.colors.warningLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  principalBadgeText: {
    fontSize: theme.typography.fontSize.xs,
  },
  inativoBadge: {
    backgroundColor: theme.colors.errorLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  inativoBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.error,
  },
  membroEmail: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  papelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  papelBadgeGestor: {
    backgroundColor: theme.colors.primaryBg,
    borderColor: theme.colors.primaryLight,
  },
  papelBadgeMotorista: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.success,
  },
  papelBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  papelBadgeTextGestor: {
    color: theme.colors.primaryDark,
  },
  papelBadgeTextMotorista: {
    color: theme.colors.success,
  },
  membroActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
  },
  youBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  youBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  footer: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  transferButton: {
    backgroundColor: theme.colors.warningLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
}));
