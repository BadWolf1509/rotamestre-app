import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from 'react-native';

import { MapaAdapter } from '@/components/MapaAdapter';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import { useResponsive } from '@/hooks/useResponsive';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { SplitView } from '@/components/desktop/SplitView';
import { DesktopModal } from '@/components/desktop/DesktopModal';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  tipo: 'entrega' | 'retirada';
  status: string;
  latitude: number | null;
  longitude: number | null;
  destinatario?: string;
  telefone?: string;
  observacoes?: string;
  foto_url?: string | null;
}

interface Rota {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  motorista?: {
    nome: string;
  };
}

export default function MapaRota() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [fotoModalVisible, setFotoModalVisible] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);

  const loadRotaEParadas = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Buscar dados da rota
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, usuarios!rotas_motorista_id_fkey(nome)')
        .eq('id', id)
        .single();

      if (rotaError) throw rotaError;

      setRota({
        ...rotaData,
        motorista: rotaData.usuarios,
      });

      // Buscar paradas da rota
      const { data: paradasData, error: paradasError } = await supabase
        .from('paradas')
        .select('*')
        .eq('rota_id', id)
        .order('ordem');

      if (paradasError) throw paradasError;

      setParadas(paradasData || []);
    } catch (error) {
      console.error('Erro ao carregar rota:', error);
      showToast('Não foi possível carregar os dados da rota', 'error');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    if (id) {
      loadRotaEParadas();
    } else {
      setLoading(false);
    }
  }, [id, loadRotaEParadas]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando rota...</Text>
      </View>
    );
  }

  // Empty state quando não há ID de rota
  if (!id) {
    return (
      <View style={styles.emptyStateContainer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.emptyStateBackLink}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.emptyStateContent}>
          <Text style={styles.emptyStateIcon}>📍</Text>
          <Text style={styles.emptyStateTitle}>Nenhuma Rota Selecionada</Text>
          <Text style={styles.emptyStateDescription}>
            Você precisa selecionar uma rota para visualizar o mapa e paradas.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/gestor/historico')}
          >
            <Text style={styles.primaryButtonText}>📋 Ver Minhas Rotas</Text>
          </TouchableOpacity>

          <Text style={styles.emptyStateOr}>Ou crie uma nova rota:</Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/gestor/nova-entrega')}
          >
            <Text style={styles.secondaryButtonText}>➕ Nova Rota</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!rota) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Rota não encontrada</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Componente Mapa reutilizável
  const MapView = () => {
    return (
      <View style={isDesktop ? styles.mapContainerSplit : styles.mapContainer}>
        <MapaAdapter paradas={paradas} />
      </View>
    );
  };

  // Componente Lista de Paradas reutilizável
  const ParadasList = () => (
    <View style={styles.paradasContainer}>
      <Text style={styles.paradasTitle}>
        Paradas ({paradas.length})
      </Text>

      {paradas.map((parada) => (
        <View key={parada.id} style={styles.paradaCard}>
            <View style={styles.paradaHeader}>
              <View style={styles.paradaNumero}>
                <Text style={styles.paradaNumeroText}>{parada.ordem}</Text>
              </View>
              <View style={styles.paradaHeaderInfo}>
                <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
                <View style={styles.paradaTags}>
                  <View style={[
                    styles.tipoTag,
                    parada.tipo === 'entrega' ? styles.tipoTagEntrega : styles.tipoTagRetirada,
                  ]}>
                    <Text style={styles.tipoTagText}>
                      {parada.tipo === 'entrega' ? '📦 Entrega' : '📥 Retirada'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusTag,
                    parada.status === 'concluida' && styles.statusTagConcluida,
                    parada.status === 'pendente' && styles.statusTagPendente,
                    parada.status === 'em_andamento' && styles.statusTagEmAndamento,
                  ]}>
                    <Text style={styles.statusTagText}>
                      {parada.status === 'concluida' && '✓ Concluída'}
                      {parada.status === 'pendente' && '⏱ Pendente'}
                      {parada.status === 'em_andamento' && '🚚 Em andamento'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {(parada.destinatario || parada.telefone || parada.observacoes) && (
              <View style={styles.paradaDetalhes}>
                {parada.destinatario && (
                  <Text style={styles.paradaDetalhe}>👤 {parada.destinatario}</Text>
                )}
                {parada.telefone && (
                  <Text style={styles.paradaDetalhe}>📞 {parada.telefone}</Text>
                )}
                {parada.observacoes && (
                  <Text style={styles.paradaDetalhe}>📝 {parada.observacoes}</Text>
                )}
              </View>
            )}

            {parada.latitude && parada.longitude && (
              <Text style={styles.coordenadas}>
                📍 {parada.latitude.toFixed(6)}, {parada.longitude.toFixed(6)}
              </Text>
            )}

            {/* Foto do Comprovante */}
            {parada.foto_url && (
              <View style={styles.fotoContainer}>
                <Text style={styles.fotoLabel}>📸 Comprovante de Entrega:</Text>
                <TouchableOpacity
                  onPress={() => {
                    setFotoSelecionada(parada.foto_url!);
                    setFotoModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: parada.foto_url }}
                    style={styles.fotoThumbnail}
                    resizeMode="cover"
                  />
                  <Text style={styles.fotoHint}>Toque para ampliar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

      {/* Resumo */}
      <View style={styles.resumo}>
        <Text style={styles.resumoTitle}>Resumo da Rota</Text>
        <View style={styles.resumoStats}>
          <View style={styles.resumoStat}>
            <Text style={styles.resumoStatValue}>{paradas.length}</Text>
            <Text style={styles.resumoStatLabel}>Paradas Totais</Text>
          </View>
          <View style={styles.resumoStat}>
            <Text style={[styles.resumoStatValue, { color: '#10b981' }]}>
              {paradas.filter((p) => p.status === 'concluida').length}
            </Text>
            <Text style={styles.resumoStatLabel}>Concluídas</Text>
          </View>
          <View style={styles.resumoStat}>
            <Text style={[styles.resumoStatValue, { color: '#f59e0b' }]}>
              {paradas.filter((p) => p.status === 'pendente').length}
            </Text>
            <Text style={styles.resumoStatLabel}>Pendentes</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Componente Breadcrumbs (apenas desktop)
  const Breadcrumbs = () => {
    const windowWidth = Dimensions.get('window').width;
    if (windowWidth < 768) return null;

    return (
      <View style={styles.breadcrumbs}>
        <TouchableOpacity
          onPress={() => router.push('/gestor/historico')}
          accessibilityLabel="Voltar para o histórico"
          accessibilityRole="button"
        >
          <Text style={styles.breadcrumbLink}>Histórico</Text>
        </TouchableOpacity>
        <Text style={styles.breadcrumbSeparator}>→</Text>
        <Text style={styles.breadcrumbCurrent}>Mapa da Rota</Text>
      </View>
    );
  };

  // Render principal

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title="Mapa da Rota"
          subtitle={`${rota?.motorista?.nome || 'Sem motorista'} • ${new Date(rota!.data).toLocaleDateString('pt-BR')}`}
          breadcrumbs={[
            { label: 'Dashboard', route: '/gestor' },
            { label: 'Histórico', route: '/gestor/historico' },
            { label: 'Mapa da Rota' }
          ]}
          actions={[
            {
              label: 'Voltar',
              icon: 'arrow-back-outline',
              onPress: () => router.back(),
              variant: 'secondary'
            }
          ]}
          fullWidth
          noPadding
        >
          {/* Info da Rota */}
          <View style={{ padding: 24, backgroundColor: theme.colors.white, borderRadius: 12, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 32, alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.colors.gray600 }}>Status:</Text>
                <View style={[
                  styles.statusBadge,
                  { paddingHorizontal: 12, paddingVertical: 4 }
                ]}>
                  <Text style={{ fontSize: 14, color: theme.colors.white, fontWeight: '600' }}>
                    {rota!.status}
                  </Text>
                </View>
              </View>

              {rota!.distancia_total && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: theme.colors.gray600 }}>Distância Total:</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.gray900, fontWeight: '600' }}>
                    {rota!.distancia_total.toFixed(1)} km
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.colors.gray600 }}>Paradas:</Text>
                <Text style={{ fontSize: 14, color: theme.colors.gray900, fontWeight: '600' }}>
                  {paradas.filter(p => p.status === 'concluida').length}/{paradas.length} concluídas
                </Text>
              </View>
            </View>
          </View>

          {/* Split View: Mapa | Lista de Paradas */}
          {paradas.length > 0 ? (
            <SplitView
              left={
                <DesktopCard
                  title="Mapa"
                  icon="map-outline"
                  iconColor={theme.colors.primary}
                  variant="elevated"
                  noPadding
                >
                  <View style={{ height: 600 }}>
                    <MapaAdapter paradas={paradas} />
                  </View>
                </DesktopCard>
              }
              right={
                <DesktopCard
                  title="Paradas"
                  subtitle={`${paradas.length} paradas na rota`}
                  icon="list-outline"
                  iconColor={theme.colors.secondary}
                  variant="outlined"
                >
                  <ScrollView style={{ maxHeight: 600 }}>
                    <ParadasList />
                  </ScrollView>
                </DesktopCard>
              }
              leftFlex={2}
              rightFlex={1}
              gap={24}
            />
          ) : (
            <DesktopCard variant="outlined">
              <View style={styles.emptyParadas}>
                <Text style={styles.emptyParadasText}>Nenhuma parada nesta rota</Text>
              </View>
            </DesktopCard>
          )}
        </DesktopPageLayout>

        {/* Modal para foto - Desktop */}
        <DesktopModal
          visible={fotoModalVisible}
          onClose={() => setFotoModalVisible(false)}
          title="Foto da Entrega"
          size="lg"
        >
          {fotoSelecionada && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Image
                source={{ uri: fotoSelecionada }}
                style={{ width: '100%', height: 500 }}
                resizeMode="contain"
              />
            </View>
          )}
        </DesktopModal>

        {/* Toast de Feedback */}
        <Toast {...toast} onDismiss={hideToast} />
      </>
    );
  }

  // Mobile Layout (original)
  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backLink}
              accessibilityLabel="Voltar para tela anterior"
              accessibilityRole="button"
            >
              <Text style={styles.backLinkText}>← Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mapa da Rota</Text>
            <Text style={styles.headerSubtitle}>
              {rota?.motorista?.nome || 'Sem motorista'} • {new Date(rota!.data).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>

        {/* Rota Info */}
        <View style={styles.rotaInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{rota!.status}</Text>
            </View>
          </View>
          {rota!.distancia_total && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Distância Total:</Text>
              <Text style={styles.infoValue}>{rota!.distancia_total.toFixed(1)} km</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {paradas.length > 0 ? (
          <>
            <MapView />
            <ParadasList />
          </>
        ) : (
          <View style={styles.emptyParadas}>
            <Text style={styles.emptyParadasText}>Nenhuma parada nesta rota</Text>
          </View>
        )}
        </View>
      </ScrollView>

      {/* Modal para visualizar foto em tamanho grande - Mobile */}
      <Modal
        visible={fotoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFotoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={() => setFotoModalVisible(false)}
            activeOpacity={1}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setFotoModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
              {fotoSelecionada && (
                <Image
                  source={{ uri: fotoSelecionada }}
                  style={styles.fotoGrande}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Toast de Feedback */}
      <Toast {...toast} onDismiss={hideToast} />
    </>
  );
}

const styles = StyleSheet.create(theme => ({
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
    marginTop: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.sm,
  },
  backButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
  header: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  breadcrumbLink: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansMedium,
  },
  breadcrumbSeparator: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray400,
  },
  breadcrumbCurrent: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  headerContent: {
    marginBottom: theme.spacing.lg,
  },
  backLink: {
    marginBottom: theme.spacing.md,
  },
  backLinkText: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  headerTitle: {
    fontSize: theme.typography['3xl'],
    fontFamily: theme.typography.fontDisplay,
    color: theme.colors.gray900,
  },
  headerSubtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  content: {
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing['2xl'],
    maxWidth: theme.layout.containerMaxWidth,
    marginHorizontal: 'auto',
    width: '100%',
  },
  rotaInfo: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray600,
    fontFamily: theme.typography.fontSansMedium,
  },
  infoValue: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  statusBadge: {
    backgroundColor: theme.colors.info + '20',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  statusBadgeText: {
    color: theme.colors.info,
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    textTransform: 'capitalize',
  },
  paradasContainer: {
    // Content padding handled by parent
  },
  paradasTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
  },
  paradaCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primaryDark,
    ...theme.shadows.sm,
  },
  paradaHeader: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  paradaNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  paradaNumeroText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: 'bold',
  },
  paradaHeaderInfo: {
    flex: 1,
  },
  paradaEndereco: {
    fontSize: theme.typography.fontSize.sm + 1,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  paradaTags: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  tipoTag: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  tipoTagEntrega: {
    backgroundColor: theme.colors.infoBg,
  },
  tipoTagRetirada: {
    backgroundColor: theme.colors.warningBg,
  },
  tipoTagText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  statusTag: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
  },
  statusTagConcluida: {
    backgroundColor: theme.colors.successBg,
  },
  statusTagPendente: {
    backgroundColor: theme.colors.errorBg,
  },
  statusTagEmAndamento: {
    backgroundColor: theme.colors.blue50,
  },
  statusTagText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.gray900,
  },
  paradaDetalhes: {
    gap: theme.spacing.sm - 2,
    marginTop: theme.spacing.sm,
  },
  paradaDetalhe: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray500,
  },
  coordenadas: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
    fontFamily: 'monospace',
  },
  resumo: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  resumoTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  resumoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumoStat: {
    alignItems: 'center',
  },
  resumoStatValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.xs,
  },
  resumoStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  splitContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xl,
    minHeight: 700,
    height: '100%',
  },
  mapColumn: {
    flex: 3,
    minHeight: 700,
  },
  listColumn: {
    flex: 2,
  },
  mapContainer: {
    height: 400,
    marginBottom: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  mapContainerSplit: {
    height: '100%',
    minHeight: 700,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  emptyParadas: {
    padding: theme.spacing['3xl'],
    alignItems: 'center',
  },
  emptyParadasText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray500,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f59e0b',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerBadgeConcluida: {
    backgroundColor: '#10b981',
  },
  markerBadgeEmAndamento: {
    backgroundColor: '#3b82f6',
  },
  markerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.xl,
  },
  emptyStateBackLink: {
    marginBottom: theme.spacing.xl,
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 100,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.xl,
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginBottom: theme.spacing['3xl'],
    lineHeight: 24,
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButton: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 320,
    shadowColor: theme.colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateOr: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray400,
    marginTop: theme.spacing['2xl'],
    marginBottom: theme.spacing.lg,
  },
  secondaryButton: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing['3xl'],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 320,
    borderWidth: 2,
    borderColor: theme.colors.primaryDark,
  },
  secondaryButtonText: {
    color: theme.colors.primaryDark,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  fotoContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray200,
  },
  fotoLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  fotoThumbnail: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
  },
  fotoHint: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
    marginTop: theme.spacing.sm - 2,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: Dimensions.get('window').width - 40,
    maxHeight: Dimensions.get('window').height - 100,
    position: 'relative',
  },
  modalCloseButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalCloseButtonText: {
    fontSize: theme.typography.fontSize['2xl'],
    color: theme.colors.gray900,
    fontWeight: 'bold',
  },
  fotoGrande: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.lg,
  },
}));
