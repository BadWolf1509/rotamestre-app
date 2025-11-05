import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { MapaAdapter } from '@/components/MapaAdapter';
import { DesktopLayout, SplitView } from '@/components/desktop';
import { useResponsive } from '@/hooks/useResponsive';

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
  const { isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [fotoModalVisible, setFotoModalVisible] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadRotaEParadas();
    } else {
      // Sem ID de rota - parar loading e mostrar mensagem
      setLoading(false);
    }
  }, [id]);

  async function loadRotaEParadas() {
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
      Alert.alert('Erro', 'Não foi possível carregar os dados da rota');
      router.back();
    } finally {
      setLoading(false);
    }
  }

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

  // Componente Header reutilizável
  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Mapa da Rota</Text>

      <View style={styles.rotaInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data:</Text>
          <Text style={styles.infoValue}>
            {new Date(rota!.data).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Motorista:</Text>
          <Text style={styles.infoValue}>{rota!.motorista?.nome || 'Não atribuído'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.infoValue, styles.statusBadge]}>
            {rota!.status}
          </Text>
        </View>
        {rota!.distancia_total && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distância:</Text>
            <Text style={styles.infoValue}>{rota!.distancia_total.toFixed(1)} km</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Componente Mapa reutilizável
  const MapView = () => (
    <View style={isDesktop ? styles.mapContainerDesktop : styles.mapContainer}>
      <MapaAdapter paradas={paradas} />
    </View>
  );

  // Componente Lista de Paradas reutilizável
  const ParadasList = () => (
    <View style={styles.paradasContainer}>
      <Text style={styles.paradasTitle}>
        Paradas ({paradas.length})
      </Text>

      {paradas.map((parada, index) => (
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

  // Render principal com SplitView para desktop
  return (
    <>
      <DesktopLayout scrollable={!isDesktop}>
        <Header />

        {paradas.length > 0 ? (
          isDesktop ? (
            // Desktop: Split horizontal (Mapa esquerda | Paradas direita)
            <SplitView
              left={<MapView />}
              right={<ScrollView><ParadasList /></ScrollView>}
              leftFlex={3}
              rightFlex={2}
              gap={24}
            />
          ) : (
            // Mobile: Empilhado vertical
            <>
              <MapView />
              <ParadasList />
            </>
          )
        ) : (
          <View style={styles.emptyParadas}>
            <Text style={styles.emptyParadasText}>Nenhuma parada nesta rota</Text>
          </View>
        )}
      </DesktopLayout>

      {/* Modal para visualizar foto em tamanho grande */}
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
    padding: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray200,
  },
  backLink: {
    marginBottom: theme.spacing.md,
  },
  backLinkText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: 'bold',
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  rotaInfo: {
    gap: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray500,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray900,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: theme.colors.infoBg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.lg,
    color: '#1e40af',
    textTransform: 'capitalize',
  },
  paradasContainer: {
    padding: theme.spacing.lg,
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
    backgroundColor: '#e0e7ff',
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
    margin: theme.spacing.lg,
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
  mapContainer: {
    height: 400,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  mapContainerDesktop: {
    height: '100%',
    minHeight: 600,
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
