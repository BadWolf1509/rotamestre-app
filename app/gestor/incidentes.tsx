import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { DataTable, DataTableAction, DataTableColumn } from '@/components/DataTable';
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopModal } from '@/components/desktop/DesktopModal';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { MobileCard, MobileEmptyState, MobileLoading } from '@/components/mobile';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
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

const CATEGORIA_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  accident: { label: 'Acidente/Incidente', icon: 'warning', color: '#ef4444' },
  absent: { label: 'Cliente ausente', icon: 'home-outline', color: '#f59e0b' },
  wrong_address: { label: 'Endereço incorreto', icon: 'location-outline', color: '#3b82f6' },
  blocked: { label: 'Acesso bloqueado', icon: 'lock-closed-outline', color: '#8b5cf6' },
  vehicle: { label: 'Problema no veículo', icon: 'car-outline', color: '#06b6d4' },
  other: { label: 'Outros', icon: 'ellipsis-horizontal-outline', color: '#6b7280' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  aberto: { label: 'Aberto', color: '#ef4444' },
  em_analise: { label: 'Em Análise', color: '#f59e0b' },
  resolvido: { label: 'Resolvido', color: '#10b981' },
  fechado: { label: 'Fechado', color: '#6b7280' },
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function IncidentesScreen() {
  const _router = useRouter();
  const { userData } = useUser();
  const { unidadeAtiva } = useUnidadeAtiva();
  const { isDesktop } = useResponsive();
  const { theme } = useUnistyles();
  const { toast, showToast, hideToast } = useToast();

  // Estado
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todos');
  const [incidenteSelecionado, setIncidenteSelecionado] = useState<Incidente | null>(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showAlterarStatusModal, setShowAlterarStatusModal] = useState(false);
  const [novoStatus, setNovoStatus] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [atualizando, setAtualizando] = useState(false);

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
    setShowDetalhesModal(true);
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
          const cat = CATEGORIA_LABELS[item.categoria];
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
          const st = STATUS_LABELS[item.status];
          return (
            <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          );
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
                      {status === 'todos' ? 'Todos' : STATUS_LABELS[status].label}
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
                      {cat === 'todos' ? 'Todos' : CATEGORIA_LABELS[cat].label}
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
          const cat = CATEGORIA_LABELS[incidente.categoria];
          const st = STATUS_LABELS[incidente.status];

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
              <Text style={styles.mobileEndereco} numberOfLines={2}>
                📍 {incidente.endereco}
              </Text>
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

    const cat = CATEGORIA_LABELS[incidenteSelecionado.categoria];
    const st = STATUS_LABELS[incidenteSelecionado.status];

    return (
      <DesktopModal
        visible={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        title="Detalhes do Incidente"
        width={700}
      >
        <ScrollView style={styles.modalContent}>
          {/* Header com categoria e status */}
          <View style={styles.detalhesHeader}>
            <View style={styles.detalhesCategoria}>
              <Ionicons name={cat.icon as any} size={24} color={cat.color} />
              <Text style={styles.detalhesCategoriaText}>{cat.label}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
              <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>

          {/* Informações */}
          <View style={styles.detalhesSection}>
            <Text style={styles.detalhesLabel}>Data/Hora:</Text>
            <Text style={styles.detalhesValue}>{formatDate(incidenteSelecionado.created_at)}</Text>
          </View>

          <View style={styles.detalhesSection}>
            <Text style={styles.detalhesLabel}>Motorista:</Text>
            <Text style={styles.detalhesValue}>{incidenteSelecionado.motorista_nome}</Text>
          </View>

          <View style={styles.detalhesSection}>
            <Text style={styles.detalhesLabel}>Local:</Text>
            <Text style={styles.detalhesValue}>{incidenteSelecionado.endereco}</Text>
          </View>

          {incidenteSelecionado.rota_id && (
            <View style={styles.detalhesSection}>
              <Text style={styles.detalhesLabel}>Rota:</Text>
              <Text style={styles.detalhesValue}>
                {incidenteSelecionado.rota_data
                  ? `Rota de ${new Date(incidenteSelecionado.rota_data).toLocaleDateString('pt-BR')}`
                  : 'N/A'}
              </Text>
            </View>
          )}

          <View style={styles.detalhesSection}>
            <Text style={styles.detalhesLabel}>Descrição:</Text>
            <Text style={styles.detalhesDescricao}>{incidenteSelecionado.descricao}</Text>
          </View>

          {incidenteSelecionado.foto_url && (
            <View style={styles.detalhesSection}>
              <Text style={styles.detalhesLabel}>Foto:</Text>
              <Image
                source={{ uri: incidenteSelecionado.foto_url }}
                style={styles.incidenteFoto}
                resizeMode="cover"
              />
            </View>
          )}

          {incidenteSelecionado.observacoes_gestao && (
            <View style={styles.detalhesSection}>
              <Text style={styles.detalhesLabel}>Observações da Gestão:</Text>
              <Text style={styles.detalhesDescricao}>{incidenteSelecionado.observacoes_gestao}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.alterarStatusButton}
            onPress={() => {
              setShowDetalhesModal(false);
              setTimeout(() => handleAlterarStatus(incidenteSelecionado), 300);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
            <Text style={styles.alterarStatusButtonText}>Alterar Status</Text>
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
        width={500}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalLabel}>Novo Status:</Text>
          <View style={styles.statusOptions}>
            {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
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

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAlterarStatusModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, atualizando && styles.buttonDisabled]}
              onPress={confirmarAlterarStatus}
              disabled={atualizando}
            >
              {atualizando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </DesktopModal>
    );
  };

  return (
    <>
      {isDesktop ? renderDesktop() : renderMobile()}
      {renderDetalhesModal()}
      {renderAlterarStatusModal()}
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
  mobileEndereco: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    marginBottom: theme.spacing.xs,
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
  modalContent: {
    padding: theme.spacing.lg,
  },
  detalhesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
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
  detalhesSection: {
    marginBottom: theme.spacing.lg,
  },
  detalhesLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
  },
  detalhesValue: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
  },
  detalhesDescricao: {
    fontSize: theme.typography.base,
    color: theme.colors.gray900,
    lineHeight: 24,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  incidenteFoto: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  alterarStatusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xl,
  },
  alterarStatusButtonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
  },
  cancelButtonText: {
    fontSize: theme.typography.base,
    color: theme.colors.gray700,
  },
  confirmButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    minWidth: 100,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.white,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
