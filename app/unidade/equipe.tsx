import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';

import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: 'gestor' | 'motorista';
  is_gestor_principal: boolean;
  ativo: boolean;
  created_at: string;
}

export default function EquipeScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { userData, loading: userLoading } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });
  const { toast: toastState, showToast, hideToast } = useToast();
  const { isDesktop, isLargeDesktop } = useBreakpoint();
  const pageMeta = getGestorPageMeta('equipe');
  const [membros, setMembros] = useState<Membro[]>([]);
  const [filteredMembros, setFilteredMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPapel, setFilterPapel] = useState<'todos' | 'gestor' | 'motorista'>('todos');
  const isDesktopView = isDesktop || isLargeDesktop;
  const isLoading = userLoading || loading;

  const loadMembros = useCallback(async () => {
    const unidadeId = userData?.unidade_id;
    if (!unidadeId) {
      setMembros([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, papel, is_gestor_principal, ativo, created_at')
        .eq('unidade_id', unidadeId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMembros(data || []);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      showToast('Erro ao carregar equipe', 'error', 4000);
    } finally {
      setLoading(false);
    }
  }, [showToast, userData?.unidade_id]);

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
      return m.nome.toLowerCase().includes(query) || m.email.toLowerCase().includes(query);
    });
    setFilteredMembros(filtered);
  }, [filterPapel, membros, searchQuery]);

  async function handleToggleAtivo(membro: Membro) {
    // Não permitir desativar o próprio usuário
    if (membro.id === userData?.id) {
      Alert.alert('Erro', 'Você não pode desativar sua própria conta.');
      return;
    }

    // Não permitir desativar gestor principal
    if (membro.is_gestor_principal) {
      Alert.alert(
        'Erro',
        'O gestor principal não pode ser desativado. Transfira a gestão primeiro.'
      );
      return;
    }

    const action = membro.ativo ? 'desativar' : 'reativar';
    Alert.alert(
      `Confirmar ${action}`,
      `Deseja ${action} o usuário ${membro.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('usuarios')
                .update({ ativo: !membro.ativo })
                .eq('id', membro.id);

              if (error) throw error;

              showToast(
                `Usuário ${membro.ativo ? 'desativado' : 'reativado'} com sucesso!`,
                'success',
                3000
              );
              await loadMembros();
            } catch (error) {
              console.error('Erro ao atualizar usuário:', error);
              showToast('Erro ao atualizar usuário', 'error', 4000);
            }
          },
        },
      ]
    );
  }

  function getPapelLabel(papel: string): string {
    return papel === 'gestor' ? 'Gestor' : 'Motorista';
  }

  function getPapelColor(papel: string): string {
    return papel === 'gestor' ? theme.colors.primary : theme.colors.success;
  }

  const isGestorPrincipal = userData?.is_gestor_principal === true;
  const ativos = membros.filter((m) => m.ativo).length;
  const inativos = membros.filter((m) => !m.ativo).length;

  const statsSection = (
    <View style={styles.statsContainer}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{membros.length}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, styles.statValuePositive]}>{ativos}</Text>
        <Text style={styles.statLabel}>Ativos</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, styles.statValueNegative]}>{inativos}</Text>
        <Text style={styles.statLabel}>Inativos</Text>
      </View>
    </View>
  );

  const searchSection = (
    <View style={styles.searchSection}>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome ou e-mail..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
    </View>
  );

  const filterSection = (
    <View style={styles.filterSection}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          filterPapel === 'todos' && styles.filterButtonActive,
        ]}
        onPress={() => setFilterPapel('todos')}
      >
        <Text
          style={[
            styles.filterButtonText,
            filterPapel === 'todos' && styles.filterButtonTextActive,
          ]}
        >
          Todos
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterButton,
          filterPapel === 'gestor' && styles.filterButtonActive,
        ]}
        onPress={() => setFilterPapel('gestor')}
      >
        <Text
          style={[
            styles.filterButtonText,
            filterPapel === 'gestor' && styles.filterButtonTextActive,
          ]}
        >
          Gestores
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterButton,
          filterPapel === 'motorista' && styles.filterButtonActive,
        ]}
        onPress={() => setFilterPapel('motorista')}
      >
        <Text
          style={[
            styles.filterButtonText,
            filterPapel === 'motorista' && styles.filterButtonTextActive,
          ]}
        >
          Motoristas
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderMembersSection = (useDesktopLayout: boolean) => {
    if (filteredMembros.length === 0) {
      const emptyState = (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery ? 'Nenhum membro encontrado' : 'Nenhum membro na equipe'}
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
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: getPapelColor(membro.papel) },
                ]}
              >
                <Text style={styles.avatarText}>
                  {membro.nome.charAt(0).toUpperCase()}
                </Text>
              </View>
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
                    isGestorRole ? styles.papelBadgeGestor : styles.papelBadgeMotorista,
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
              !membro.is_gestor_principal && (
                <View style={styles.membroActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      membro.ativo ? styles.actionButtonDanger : styles.actionButtonSuccess,
                    ]}
                    onPress={() => handleToggleAtivo(membro)}
                  >
                    <Text style={styles.actionButtonText}>
                      {membro.ativo ? '🚫 Desativar' : '✅ Reativar'}
                    </Text>
                  </TouchableOpacity>
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
        <TouchableOpacity
          style={styles.transferButton}
          onPress={() => router.push('/unidade/transferir')}
        >
          <Text style={styles.transferButtonText}>🔄 Transferir Gestão Principal</Text>
        </TouchableOpacity>
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
      <>
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
        {logoutModal}
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando equipe...</Text>
        </View>
        {logoutModal}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {statsSection}
      {searchSection}
      {filterSection}
      {renderMembersSection(false)}
      {footerSection}
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </View>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  statValuePositive: {
    color: theme.colors.success,
  },
  statValueNegative: {
    color: theme.colors.error,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  searchSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  filterSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterButtonTextActive: {
    color: theme.colors.surface,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
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
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  membroCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.gray200,
    ...theme.shadows.sm,
    // Web-only: Smooth transitions and hover
    ...(Platform.OS === 'web' && {
      transitionProperty: 'all',
      transitionDuration: '0.2s',
      transitionTimingFunction: 'ease-in-out',
      // @ts-ignore - web-only CSS
      ':hover': {
        borderColor: theme.colors.primary,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        transform: 'translateY(-2px)',
      },
    }),
  },
  membroCardGrid: {
    // 3 colunas no desktop: (100% - 2 gaps) / 3
    // gap: 16px, então: calc((100% - 32px) / 3)
    width: 'calc((100% - 32px) / 3)',
    minWidth: 280,
    marginBottom: 0, // Gap já gerencia espaçamento
  },
  membroCardInativo: {
    opacity: 0.6,
  },
  membroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.surface,
  },
  membroInfo: {
    flex: 1,
  },
  membroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  membroNome: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  principalBadge: {
    backgroundColor: theme.colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  principalBadgeText: {
    fontSize: 12,
  },
  inativoBadge: {
    backgroundColor: theme.colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inativoBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.error,
  },
  membroEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  papelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
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
    fontSize: 12,
    fontWeight: '600',
  },
  papelBadgeTextGestor: {
    color: theme.colors.primaryDark,
  },
  papelBadgeTextMotorista: {
    color: theme.colors.success,
  },
  membroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  actionButtonSuccess: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  youBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  youBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },
  footer: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  transferButton: {
    backgroundColor: theme.colors.warningLight,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.warning,
  },
  transferButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.warningDark,
  },
}));




