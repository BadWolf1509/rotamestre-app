import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  FilterChip,
  MobileButton,
  MobileCard,
  MobileEmptyState,
  MobileLoading,
  Modal,
  StatusBadge,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// TYPES
// ============================================

interface Incidente {
  id: string;
  categoria: string;
  descricao: string;
  endereco: string;
  status: string;
  foto_url: string | null;
  created_at: string;
  motorista_nome: string;
  motorista_id: string;
  unidade_nome: string;
  rota_id: string | null;
  rota_data: string | null;
  parada_endereco: string | null;
  observacoes_gestao: string | null;
}

type FiltroStatus = 'todos' | 'aberto' | 'em_analise' | 'resolvido' | 'fechado';
type FiltroCategoria = 'todos' | 'accident' | 'absent' | 'wrong_address' | 'blocked' | 'vehicle' | 'other';

// ============================================
// CONSTANTS
// ============================================

// ============================================
// MAIN COMPONENT
// ============================================

export default function IncidentesScreen() {
  const router = useRouter();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();
  const { toast, showToast, hideToast } = useToast();

  const categoriaLabels = useMemo<Record<string, { label: string; icon: string; color: string }>>(
    () => ({
      accident: { label: 'Acidente/Incidente', icon: 'warning', color: theme.colors.incident.accident },
      absent: { label: 'Cliente ausente', icon: 'home-outline', color: theme.colors.incident.absent },
      wrong_address: { label: 'Endereço incorreto', icon: 'location-outline', color: theme.colors.incident.wrongAddress },
      blocked: { label: 'Acesso bloqueado', icon: 'lock-closed-outline', color: theme.colors.incident.blocked },
      vehicle: { label: 'Problema no veículo', icon: 'car-outline', color: theme.colors.incident.vehicle },
      other: { label: 'Outros', icon: 'ellipsis-horizontal-outline', color: theme.colors.incident.other },
    }),
    [theme]
  );

  const statusLabels = useMemo<Record<string, { label: string; color: string }>>(
    () => ({
      aberto: { label: 'Aberto', color: theme.colors.error },
      em_analise: { label: 'Em Análise', color: theme.colors.warning },
      resolvido: { label: 'Resolvido', color: theme.colors.success },
      fechado: { label: 'Fechado', color: theme.colors.gray500 },
    }),
    [theme]
  );

  // Estado
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todos');
  const [incidenteSelecionado, setIncidenteSelecionado] = useState<Incidente | null>(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showAlterarStatusModal, setShowAlterarStatusModal] = useState(false);
  const [showHistoricoMotoristaModal, setShowHistoricoMotoristaModal] = useState(false);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [incidentesMotorista, setIncidentesMotorista] = useState<Incidente[]>([]);
  const [novoStatus, setNovoStatus] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  // Estados para foto do incidente no modal de detalhes
  const [fotoLoading, setFotoLoading] = useState(true);
  const [fotoError, setFotoError] = useState(false);
  const [fotoRetryCount, setFotoRetryCount] = useState(0);

  // Desktop header menu
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });

  // Buscar incidentes
  const fetchIncidentes = useCallback(async () => {
    try {
      setLoading(true);

      if (!unidadeAtiva) {
        console.warn('⚠️ Usuário sem unidade ativa');
        setLoading(false);
        return;
      }

      // Buscar incidentes da unidade do gestor
      // Primeiro buscar IDs dos motoristas da unidade via usuario_unidades
      const { data: vinculacoes } = await supabase
        .from('usuario_unidades')
        .select('usuario_id')
        .eq('unidade_id', unidadeAtiva)
        .eq('papel', 'motorista')
        .eq('ativo', true);

      const motoristas = vinculacoes?.map((v) => ({ id: v.usuario_id })) || [];

      if (!motoristas || motoristas.length === 0) {
        setIncidentes([]);
        return;
      }

      const motoristasIds = motoristas.map(m => m.id);

      // Buscar incidentes desses motoristas com JOIN nas tabelas relacionadas
      let query = supabase
        .from('incidentes')
        .select(`
          id,
          categoria,
          descricao,
          endereco,
          status,
          foto_url,
          created_at,
          observacoes_gestao,
          motorista:usuarios!motorista_id (nome),
          rota:rotas (id, data),
          parada:paradas (endereco)
        `)
        .in('motorista_id', motoristasIds)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }
      if (filtroCategoria !== 'todos') {
        query = query.eq('categoria', filtroCategoria);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transformar os dados para o formato esperado
      const incidentesFormatados = (data || []).map((inc: any) => ({
        id: inc.id,
        categoria: inc.categoria,
        descricao: inc.descricao,
        endereco: inc.endereco,
        status: inc.status,
        foto_url: inc.foto_url,
        created_at: inc.created_at,
        observacoes_gestao: inc.observacoes_gestao,
        motorista_nome: inc.motorista?.nome || 'Desconhecido',
        motorista_id: inc.motorista_id,
        unidade_nome: userData?.unidades?.nome || '',
        rota_id: inc.rota?.id || null,
        rota_data: inc.rota?.data || null,
        parada_endereco: inc.parada?.endereco || null,
      }));

      setIncidentes(incidentesFormatados);
    } catch (error) {
      console.error('❌ Erro ao buscar incidentes:', error);
      showToast('Erro ao carregar incidentes', 'error');
    } finally {
      setLoading(false);
    }
  }, [unidadeAtiva, userData?.unidades?.nome, filtroStatus, filtroCategoria, showToast]);

  useEffect(() => {
    fetchIncidentes();
  }, [fetchIncidentes]);

  // Visualizar detalhes
  const handleVerDetalhes = (incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    // Reset estados da foto
    setFotoLoading(true);
    setFotoError(false);
    setFotoRetryCount(0);
    setShowDetalhesModal(true);
  };

  // Handlers para foto do incidente
  const handleFotoLoad = () => {
    setFotoLoading(false);
    setFotoError(false);
  };

  const handleFotoError = () => {
    setFotoLoading(false);
    setFotoError(true);
  };

  const handleFotoRetry = () => {
    setFotoRetryCount((prev) => prev + 1);
    setFotoLoading(true);
    setFotoError(false);
  };

  // Alterar status
  const handleAlterarStatus = (incidente: Incidente) => {
    setIncidenteSelecionado(incidente);
    setNovoStatus(incidente.status);
    setObservacoes(incidente.observacoes_gestao || '');
    setShowAlterarStatusModal(true);
  };

  const confirmarAlterarStatus = async () => {
    if (!incidenteSelecionado) return;

    try {
      setAtualizando(true);

      const { error } = await supabase
        .from('incidentes')
        .update({
          status: novoStatus,
          observacoes_gestao: observacoes || null,
          updated_at: new Date().toISOString(),
          ...(novoStatus === 'resolvido' && { resolvido_em: new Date().toISOString() }),
        })
        .eq('id', incidenteSelecionado.id);

      if (error) throw error;

      showToast('Status atualizado com sucesso', 'success');
      setShowAlterarStatusModal(false);
      fetchIncidentes();
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setAtualizando(false);
    }
  };

  // Estatísticas por motorista (calculado a partir dos incidentes carregados)
  const estatisticasMotorista = useMemo(() => {
    const stats: Record<string, { nome: string; total: number; abertos: number; resolvidos: number }> = {};

    incidentes.forEach((inc) => {
      if (!stats[inc.motorista_id]) {
        stats[inc.motorista_id] = {
          nome: inc.motorista_nome,
          total: 0,
          abertos: 0,
          resolvidos: 0,
        };
      }
      stats[inc.motorista_id].total++;
      if (inc.status === 'aberto' || inc.status === 'em_analise') {
        stats[inc.motorista_id].abertos++;
      }
      if (inc.status === 'resolvido' || inc.status === 'fechado') {
        stats[inc.motorista_id].resolvidos++;
      }
    });

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Top 5
  }, [incidentes]);

  // Resumo geral
  const resumoGeral = useMemo(() => {
    const abertos = incidentes.filter(i => i.status === 'aberto').length;
    const emAnalise = incidentes.filter(i => i.status === 'em_analise').length;
    const resolvidos = incidentes.filter(i => i.status === 'resolvido').length;
    const fechados = incidentes.filter(i => i.status === 'fechado').length;

    // Contar por categoria
    const porCategoria: Record<string, number> = {};
    incidentes.forEach((inc) => {
      porCategoria[inc.categoria] = (porCategoria[inc.categoria] || 0) + 1;
    });

    return {
      total: incidentes.length,
      abertos,
      emAnalise,
      resolvidos,
      fechados,
      porCategoria,
    };
  }, [incidentes]);

  // Ver histórico de incidentes de um motorista
  const handleVerHistoricoMotorista = async (motoristaId: string, motoristaNome: string) => {
    setMotoristaSelecionado({ id: motoristaId, nome: motoristaNome });
    // Filtrar incidentes do motorista
    const incidentesDoMotorista = incidentes.filter(inc => inc.motorista_id === motoristaId);
    setIncidentesMotorista(incidentesDoMotorista);
    setShowHistoricoMotoristaModal(true);
  };

  // Remarcar entrega (criar nova rota com o endereço do incidente)
  const handleRemarcarEntrega = (incidente: Incidente) => {
    // Fechar modal de detalhes
    setShowDetalhesModal(false);
    // Navegar para nova-entrega com endereço pré-preenchido
    // O endereço é passado via query params
    const enderecoEncoded = encodeURIComponent(incidente.endereco);
    router.push(`/gestor/nova-entrega?endereco=${enderecoEncoded}`);
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Renderização Desktop
  const renderDesktop = () => {
    const columns: DataTableColumn<Incidente>[] = [
      {
        key: 'created_at',
        label: 'Data/Hora',
        width: 140,
        render: (item) => <Text style={styles.tableText}>{formatDate(item.created_at)}</Text>,
      },
      {
        key: 'motorista_nome',
        label: 'Motorista',
        width: 220,
        render: (item) => <Text style={styles.tableText}>{item.motorista_nome}</Text>,
      },
      {
        key: 'categoria',
        label: 'Categoria',
        width: 180,
        render: (item) => {
          const cat = categoriaLabels[item.categoria];
          return (
            <View style={styles.categoriaContainer}>
              <Ionicons name={cat.icon as any} size={16} color={cat.color} />
              <Text style={[styles.tableText, { marginLeft: 6 }]}>{cat.label}</Text>
            </View>
          );
        },
      },
      {
        key: 'endereco',
        label: 'Local',
        width: 280,
        render: (item) => (
          <Text style={styles.tableText} numberOfLines={2}>
            {item.endereco}
          </Text>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 120,
        render: (item) => {
          const st = statusLabels[item.status];
          return <StatusBadge color={st.color} label={st.label} variant="soft" />;
        },
      },
    ];

    const actions: DataTableAction<Incidente>[] = [
      {
        icon: 'eye-outline',
        label: 'Ver Detalhes',
        type: 'secondary', // ✅ Ação de leitura = secundária
        onPress: handleVerDetalhes,
      },
      {
        icon: 'create-outline',
        label: 'Alterar Status',
        type: 'primary', // ✅ Ação de modificação = primária
        onPress: handleAlterarStatus,
      },
    ];

    return (
      <DesktopPageLayout
        title={getGestorPageMeta('incidentes').title}
        subtitle={getGestorPageMeta('incidentes').subtitle}
        icon={getGestorPageMeta('incidentes').icon}
        breadcrumbs={getGestorPageMeta('incidentes').breadcrumbs}
        userMenuTrigger={userMenuTrigger}
        userMenuItems={userMenuItems}
      >
        {/* Cards de Resumo */}
        <View style={styles.resumoRow}>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.error + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.error }]}>{resumoGeral.abertos}</Text>
            <Text style={styles.resumoLabel}>Abertos</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.warning + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.warning }]}>{resumoGeral.emAnalise}</Text>
            <Text style={styles.resumoLabel}>Em Análise</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.success + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.success }]}>{resumoGeral.resolvidos}</Text>
            <Text style={styles.resumoLabel}>Resolvidos</Text>
          </View>
          <View style={[styles.resumoCard, { backgroundColor: theme.colors.gray400 + '15' }]}>
            <Text style={[styles.resumoValue, { color: theme.colors.gray600 }]}>{resumoGeral.total}</Text>
            <Text style={styles.resumoLabel}>Total</Text>
          </View>
        </View>

        {/* Incidentes por Motorista */}
        {estatisticasMotorista.length > 0 && (
          <DesktopCard title="Incidentes por Motorista" subtitle="Top 5 motoristas com mais incidentes">
            <View style={styles.motoristaStatsContainer}>
              {estatisticasMotorista.map((stat, index) => (
                <TouchableOpacity
                  key={stat.id}
                  style={styles.motoristaStat}
                  onPress={() => handleVerHistoricoMotorista(stat.id, stat.nome)}
                >
                  <View style={styles.motoristaRank}>
                    <Text style={styles.motoristaRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.motoristaInfo}>
                    <Text style={styles.motoristaNome}>{stat.nome}</Text>
                    <Text style={styles.motoristaStats}>
                      {stat.total} incidentes ({stat.abertos} abertos, {stat.resolvidos} resolvidos)
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
                </TouchableOpacity>
              ))}
            </View>
          </DesktopCard>
        )}

        <DesktopCard title="Incidentes Reportados">
          {/* Filtros */}
          <View style={styles.filtrosContainer}>
            <View style={styles.filtroGroup}>
              <Text style={styles.filtroLabel}>Status:</Text>
              <View style={styles.filtroButtons}>
                {(['todos', 'aberto', 'em_analise', 'resolvido', 'fechado'] as FiltroStatus[]).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filtroButton,
                      filtroStatus === status && styles.filtroButtonActive,
                    ]}
                    onPress={() => setFiltroStatus(status)}
                  >
                    <Text
                      style={[
                        styles.filtroButtonText,
                        filtroStatus === status && styles.filtroButtonTextActive,
                      ]}
                    >
                      {status === 'todos' ? 'Todos' : statusLabels[status].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filtroGroup}>
              <Text style={styles.filtroLabel}>Categoria:</Text>
              <View style={styles.filtroButtons}>
                {(['todos', 'accident', 'absent', 'wrong_address', 'blocked', 'vehicle', 'other'] as FiltroCategoria[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filtroButton,
                      filtroCategoria === cat && styles.filtroButtonActive,
                    ]}
                    onPress={() => setFiltroCategoria(cat)}
                  >
                    <Text
                      style={[
                        styles.filtroButtonText,
                        filtroCategoria === cat && styles.filtroButtonTextActive,
                      ]}
                    >
                      {cat === 'todos' ? 'Todos' : categoriaLabels[cat].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <DataTable
              data={incidentes}
              columns={columns}
              actions={actions}
              keyExtractor={(item) => item.id}
              emptyState={
                <View style={{ padding: theme.spacing['2xl'], alignItems: 'center' }}>
                  <Text style={{ fontSize: theme.typography.base, color: theme.colors.gray600 }}>
                    Nenhum incidente encontrado
                  </Text>
                </View>
              }
            />
          )}
        </DesktopCard>
      </DesktopPageLayout>
    );
  };

  // Renderização Mobile
  const renderMobile = () => {
    if (loading) {
      return <MobileLoading />;
    }

    if (incidentes.length === 0) {
      return (
        <MobileEmptyState
          icon="⚠️"
          title="Nenhum incidente"
          subtitle="Não há incidentes reportados no momento."
        />
      );
    }

    return (
      <ScrollView style={styles.mobileContainer}>
        {incidentes.map((incidente) => {
          const cat = categoriaLabels[incidente.categoria];
          const st = statusLabels[incidente.status];

          return (
            <MobileCard
              key={incidente.id}
              onPress={() => handleVerDetalhes(incidente)}
            >
              <View style={styles.mobileHeader}>
                <View style={styles.mobileCategoriaRow}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                  <Text style={styles.mobileCategoriaText}>{cat.label}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              <Text style={styles.mobileMotorista}>{incidente.motorista_nome}</Text>
              <View style={styles.mobileEnderecoRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.gray500} />
                <Text style={styles.mobileEndereco} numberOfLines={2}>
                  {incidente.endereco}
                </Text>
              </View>
              <Text style={styles.mobileData}>{formatDate(incidente.created_at)}</Text>

              <TouchableOpacity
                style={styles.mobileActionButton}
                onPress={() => handleAlterarStatus(incidente)}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.mobileActionText}>Alterar Status</Text>
              </TouchableOpacity>
            </MobileCard>
          );
        })}
      </ScrollView>
    );
  };

  // Modal de detalhes
  const renderDetalhesModal = () => {
    if (!incidenteSelecionado) return null;

    const cat = categoriaLabels[incidenteSelecionado.categoria];
    const st = statusLabels[incidenteSelecionado.status];

    // URL da foto com retry param para forçar reload
    const fotoUri = incidenteSelecionado.foto_url
      ? (fotoRetryCount > 0 ? `${incidenteSelecionado.foto_url}?retry=${fotoRetryCount}` : incidenteSelecionado.foto_url)
      : null;

    return (
      <DesktopModal
        visible={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        title="Detalhes do Incidente"
        maxWidth={600}
        primaryButton={{
          text: 'Alterar Status',
          onPress: () => {
            setShowDetalhesModal(false);
            setTimeout(() => handleAlterarStatus(incidenteSelecionado), 300);
          },
        }}
        secondaryButton={{
          text: 'Remarcar Entrega',
          onPress: () => handleRemarcarEntrega(incidenteSelecionado),
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header com categoria e status */}
          <View style={[styles.detalhesHeader, isDesktop && styles.detalhesHeaderCompact]}>
            <View style={styles.detalhesCategoria}>
              <Ionicons name={cat.icon as any} size={isDesktop ? 20 : 24} color={cat.color} />
              <Text style={[styles.detalhesCategoriaText, isDesktop && styles.detalhesCategoriaTextCompact]}>
                {cat.label}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          {/* Informações */}
          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Data/Hora:</Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {formatDate(incidenteSelecionado.created_at)}
            </Text>
          </View>

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Motorista:</Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {incidenteSelecionado.motorista_nome}
            </Text>
          </View>

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Local:</Text>
            <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
              {incidenteSelecionado.endereco}
            </Text>
          </View>

          {incidenteSelecionado.rota_id && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Rota:</Text>
              <Text style={[styles.detalhesValue, isDesktop && styles.detalhesValueCompact]}>
                {incidenteSelecionado.rota_data
                  ? `Rota de ${new Date(incidenteSelecionado.rota_data).toLocaleDateString('pt-BR')}`
                  : 'N/A'}
              </Text>
            </View>
          )}

          <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
            <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Descrição:</Text>
            <Text style={[styles.detalhesDescricao, isDesktop && styles.detalhesDescricaoCompact]}>
              {incidenteSelecionado.descricao}
            </Text>
          </View>

          {/* Foto com loading/error handling */}
          {fotoUri && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>Foto:</Text>
              <View style={[styles.fotoContainer, isDesktop && styles.fotoContainerCompact]}>
                {/* Loading indicator */}
                {fotoLoading && !fotoError && (
                  <View style={styles.fotoLoadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={styles.fotoLoadingText}>Carregando foto...</Text>
                  </View>
                )}

                {/* Error state */}
                {fotoError && (
                  <View style={styles.fotoErrorContainer}>
                    <Ionicons name="image-outline" size={48} color={theme.colors.gray400} />
                    <Text style={styles.fotoErrorText}>Não foi possível carregar a foto</Text>
                    <TouchableOpacity style={styles.fotoRetryButton} onPress={handleFotoRetry}>
                      <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                      <Text style={styles.fotoRetryText}>Tentar novamente</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Image */}
                {!fotoError && (
                  <Image
                    source={{ uri: fotoUri }}
                    style={[
                      styles.incidenteFoto,
                      isDesktop && styles.incidenteFotoCompact,
                      { opacity: fotoLoading ? 0 : 1 },
                    ]}
                    resizeMode="cover"
                    onLoad={handleFotoLoad}
                    onError={handleFotoError}
                    accessibilityLabel={`Foto do incidente: ${cat.label}`}
                  />
                )}
              </View>
            </View>
          )}

          {incidenteSelecionado.observacoes_gestao && (
            <View style={[styles.detalhesSection, isDesktop && styles.detalhesSectionCompact]}>
              <Text style={[styles.detalhesLabel, isDesktop && styles.detalhesLabelCompact]}>
                Observações da Gestão:
              </Text>
              <Text style={[styles.detalhesDescricao, isDesktop && styles.detalhesDescricaoCompact]}>
                {incidenteSelecionado.observacoes_gestao}
              </Text>
            </View>
          )}

          {/* Link para histórico do motorista */}
          <TouchableOpacity
            style={[styles.verHistoricoLink, isDesktop && styles.verHistoricoLinkCompact]}
            onPress={() => {
              setShowDetalhesModal(false);
              setTimeout(() => handleVerHistoricoMotorista(incidenteSelecionado.motorista_id, incidenteSelecionado.motorista_nome), 300);
            }}
            accessibilityRole="link"
            accessibilityLabel={`Ver histórico de incidentes de ${incidenteSelecionado.motorista_nome}`}
          >
            <Ionicons name="time-outline" size={isDesktop ? 14 : 16} color={theme.colors.primary} />
            <Text style={[styles.verHistoricoLinkText, isDesktop && styles.verHistoricoLinkTextCompact]}>
              Ver histórico de incidentes deste motorista
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </DesktopModal>
    );
  };

  // Modal de alterar status
  const renderAlterarStatusModal = () => {
    if (!incidenteSelecionado) return null;

    return (
      <DesktopModal
        visible={showAlterarStatusModal}
        onClose={() => setShowAlterarStatusModal(false)}
        title="Alterar Status do Incidente"
        maxWidth={500}
        primaryButton={{
          text: 'Salvar',
          onPress: confirmarAlterarStatus,
          loading: atualizando,
        }}
        secondaryButton={{
          text: 'Cancelar',
          onPress: () => setShowAlterarStatusModal(false),
          disabled: atualizando,
        }}
      >
        <View>
          <Text style={styles.modalLabel}>Novo Status:</Text>
          <View style={styles.statusOptions}>
            {Object.entries(statusLabels).map(([key, { label, color }]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.statusOption,
                  novoStatus === key && styles.statusOptionActive,
                  { borderColor: color },
                ]}
                onPress={() => setNovoStatus(key)}
              >
                <Text
                  style={[
                    styles.statusOptionText,
                    novoStatus === key && { color },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalLabel, { marginTop: 20 }]}>Observações (opcional):</Text>
          <TextInput
            style={styles.observacoesInput}
            placeholder="Adicione observações sobre a resolução..."
            value={observacoes}
            onChangeText={setObservacoes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </DesktopModal>
    );
  };

  // Modal de histórico de incidentes do motorista
  const renderHistoricoMotoristaModal = () => {
    if (!motoristaSelecionado) return null;

    return (
      <DesktopModal
        visible={showHistoricoMotoristaModal}
        onClose={() => setShowHistoricoMotoristaModal(false)}
        title={`Histórico de Incidentes - ${motoristaSelecionado.nome}`}
        maxWidth={700}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {incidentesMotorista.length === 0 ? (
            <View style={styles.emptyHistorico}>
              <Text style={styles.emptyHistoricoText}>Nenhum incidente encontrado para este motorista</Text>
            </View>
          ) : (
            incidentesMotorista.map((inc) => {
              const cat = categoriaLabels[inc.categoria];
              const st = statusLabels[inc.status];

              return (
                <View key={inc.id} style={styles.historicoItem}>
                  <View style={styles.historicoHeader}>
                    <View style={styles.historicoCategoria}>
                      <Ionicons name={cat.icon as any} size={16} color={cat.color} />
                      <Text style={styles.historicoCategoriaText}>{cat.label}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.historicoEndereco}>{inc.endereco}</Text>
                  <Text style={styles.historicoData}>{formatDate(inc.created_at)}</Text>
                  {inc.descricao && (
                    <Text style={styles.historicoDescricao} numberOfLines={2}>{inc.descricao}</Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </DesktopModal>
    );
  };

  return (
    <>
      {isDesktop ? renderDesktop() : renderMobile()}
      {renderDetalhesModal()}
      {renderAlterarStatusModal()}
      {renderHistoricoMotoristaModal()}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
      {logoutModal}
    </>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create((theme: Theme) => ({
  // Filtros
  filtrosContainer: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  filtroGroup: {
    gap: theme.spacing.sm,
  },
  filtroLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  filtroButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filtroButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
  },
  filtroButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filtroButtonText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  filtroButtonTextActive: {
    color: theme.colors.white,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Table
  tableText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
  },
  categoriaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
  },

  // Mobile
  mobileContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  mobileCategoriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  mobileCategoriaText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  mobileMotorista: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  mobileEnderecoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  mobileEndereco: {
    flex: 1,
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },
  mobileData: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
  },
  mobileActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  mobileActionText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },

  // Modal de detalhes
  detalhesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  detalhesHeaderCompact: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  detalhesCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detalhesCategoriaText: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  detalhesCategoriaTextCompact: {
    fontSize: theme.typography.base,
  },
  detalhesSection: {
    marginBottom: theme.spacing.lg,
  },
  detalhesSectionCompact: {
    marginBottom: theme.spacing.md,
  },
  detalhesLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  detalhesLabelCompact: {
    fontSize: 13,
    marginBottom: 4,
  },
  detalhesValue: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
  },
  detalhesValueCompact: {
    fontSize: 14,
  },
  detalhesDescricao: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    lineHeight: 24,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  detalhesDescricaoCompact: {
    fontSize: 14,
    lineHeight: 20,
    padding: theme.spacing.sm,
  },

  // Foto do incidente com loading/error
  fotoContainer: {
    minHeight: 200,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  fotoContainerCompact: {
    minHeight: 180,
  },
  incidenteFoto: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
  },
  incidenteFotoCompact: {
    height: 240,
  },
  fotoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  fotoLoadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  fotoErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    minHeight: 200,
  },
  fotoErrorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  fotoRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryBg,
  },
  fotoRetryText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },

  // Modal de status
  modalLabel: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    backgroundColor: theme.colors.white,
  },
  statusOptionActive: {
    backgroundColor: theme.colors.gray50,
  },
  statusOptionText: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray700,
  },
  observacoesInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    minHeight: 100,
  },
  // Resumo cards
  resumoRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing['3xl'],
  },
  resumoCard: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  resumoValue: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontSansBold,
    marginBottom: 4,
  },
  resumoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
  },

  // Estatísticas por motorista
  motoristaStatsContainer: {
    gap: theme.spacing.sm,
  },
  motoristaStat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  motoristaRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  motoristaRankText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.white,
  },
  motoristaInfo: {
    flex: 1,
  },
  motoristaNome: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },
  motoristaStats: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 2,
  },

  // Link para histórico do motorista
  verHistoricoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  verHistoricoLinkCompact: {
    marginTop: theme.spacing.md,
    paddingVertical: 6,
  },
  verHistoricoLinkText: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
  },
  verHistoricoLinkTextCompact: {
    fontSize: 13,
  },

  // Modal de histórico
  emptyHistorico: {
    padding: theme.spacing['2xl'],
    alignItems: 'center',
  },
  emptyHistoricoText: {
    fontSize: theme.typography.base,
    color: theme.colors.gray500,
  },
  historicoItem: {
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  historicoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  historicoCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  historicoCategoriaText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  historicoEndereco: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    marginBottom: 4,
  },
  historicoData: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.sm,
  },
  historicoDescricao: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    fontStyle: 'italic',
  },
}));
