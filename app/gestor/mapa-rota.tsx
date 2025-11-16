import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopModal } from '@/components/desktop/DesktopModal';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { SplitView } from '@/components/desktop/SplitView';
import { MapaAdapter } from '@/components/MapaAdapter';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { StyleSheet, useUnistyles } from '@/utils/styles';
import type { Theme } from '@/utils/styles';

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
  is_checkpoint?: boolean;
}

interface Rota {
  id: string;
  data: string;
  status: string;
  distancia_total?: number;
  updated_at?: string;
  motorista?: {
    nome: string;
  };
}

function formatarDataLocal(dateStr?: string, locale = 'pt-BR'): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '-';
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale);
}

function formatarDataHora(dateStr?: string, locale = 'pt-BR'): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeVariant(theme: Theme, status?: string) {
  const palette = {
    pendente: {
      bg: theme.colors.warningBg,
      border: theme.colors.warning,
      text: theme.colors.warning,
    },
    em_andamento: {
      bg: theme.colors.infoBg,
      border: theme.colors.info,
      text: theme.colors.info,
    },
    concluida: {
      bg: theme.colors.successBg,
      border: theme.colors.success,
      text: theme.colors.success,
    },
    cancelada: {
      bg: theme.colors.errorBg,
      border: theme.colors.error,
      text: theme.colors.error,
    },
    default: {
      bg: theme.colors.gray100,
      border: theme.colors.gray300,
      text: theme.colors.gray700,
    },
  } as const;

  const normalized = (status ?? 'default').toLowerCase() as keyof typeof palette;
  const variant = palette[normalized] || palette.default;

  return {
    container: {
      backgroundColor: variant.bg,
      borderColor: variant.border,
    },
    text: {
      color: variant.text,
    },
  };
}

function formatStatusLabel(status?: string) {
  if (!status) return '-';
  const normalized = status.toLowerCase();
  const labels: Record<string, string>= {
    pendente: 'pendente',
    em_andamento: 'em andamento',
    concluida: 'concluida',
    cancelada: 'cancelada',
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  return normalized.replace(/_/g, ' ');
}

export default function MapaRota() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const { userData } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [fotoModalVisible, setFotoModalVisible] = useState(false);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);
  const pageMeta = getGestorPageMeta('mapaRota');

  const statusBadgeVariant = useMemo(
    () =>getStatusBadgeVariant(theme, rota?.status),
    [theme, rota?.status]
  );
  const statusLabel = useMemo(() =>formatStatusLabel(rota?.status), [rota?.status]);

  const paradasReais = useMemo(
    () =>paradas.filter((parada) =>parada.is_checkpoint !== false),
    [paradas]
  );

  const pontosBase = useMemo(
    () =>paradas.filter((parada) =>parada.is_checkpoint === false),
    [paradas]
  );

  const resumoParadas = useMemo(() =>{
    const total = paradasReais.length;
    const concluidas = paradasReais.filter((p) =>p.status === 'concluida').length;
    const pendentes = paradasReais.filter((p) =>p.status === 'pendente').length;
    const emAndamento = paradasReais.filter((p) =>p.status === 'em_andamento').length;
    return { total, concluidas, pendentes, emAndamento };
  }, [paradasReais]);

  const baseInicio = useMemo(() =>{
    if (pontosBase.length === 0) return null;
    return pontosBase.reduce((prev, curr) =>(curr.ordem < prev.ordem ? curr : prev));
  }, [pontosBase]);

  const baseFim = useMemo(() =>{
    if (pontosBase.length === 0) return null;
    return pontosBase.reduce((prev, curr) =>(curr.ordem >prev.ordem ? curr : prev));
  }, [pontosBase]);

  const loadRotaEParadas = useCallback(async () =>{
    if (!id) return;

    try {
      setLoading(true);

      // Buscar dados da rota
      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, updated_at, usuarios!rotas_motorista_id_fkey(nome)')
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
      showToast('Nao foi possivel carregar os dados da rota', 'error');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() =>{
    if (id) {
      loadRotaEParadas();
    } else {
      setLoading(false);
    }
  }, [id, loadRotaEParadas]);

  if (loading) {
    return (
      <>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando rota...</Text>
        </View>
        {logoutModal}
      </>
    );
  }

  // Empty state quando nao ha ID de rota
  if (!id) {
    return (
      <>
        <View style={styles.emptyStateContainer}>
          <TouchableOpacity onPress={() =>router.back()} style={styles.emptyStateBackLink}>
            <Text style={styles.backLinkText}>{'<-'} Voltar</Text>
          </TouchableOpacity>

          <View style={styles.emptyStateContent}>
            <Text style={styles.emptyStateIcon}>*</Text>
            <Text style={styles.emptyStateTitle}>Nenhuma Rota Selecionada</Text>
            <Text style={styles.emptyStateDescription}>
              Voce precisa selecionar uma rota para visualizar o mapa e paradas.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>router.push('/gestor/historico')}
            >
              <Text style={styles.primaryButtonText}>* Ver Minhas Rotas</Text>
            </TouchableOpacity>

            <Text style={styles.emptyStateOr}>Ou crie uma nova rota:</Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() =>router.push('/gestor/nova-entrega')}
            >
              <Text style={styles.secondaryButtonText}>+ Nova Rota</Text>
            </TouchableOpacity>
          </View>
        </View>
        {logoutModal}
      </>
    );
  }

  if (!rota) {
    return (
      <>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Rota nao encontrada</Text>
          <TouchableOpacity style={styles.backButton} onPress={() =>router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
        {logoutModal}
      </>
    );
  }

  // Componente Mapa reutilizavel
  const MapView = () =>{
    return (
      <View style={isDesktop ? styles.mapContainerSplit : styles.mapContainer}>
        <MapaAdapter paradas={paradas} />
      </View>
    );
  };

  const hasBaseInfo = Boolean(baseInicio || baseFim);

  const BaseInfoContent = () => {
    if (!hasBaseInfo) {
      return (
        <Text style={styles.baseInfoEmpty}>
          Nenhum endereco da unidade foi cadastrado.
        </Text>
      );
    }

    const entries = [
      baseInicio
        ? {
            label: 'Partida',
            value: baseInicio.endereco,
            icon: 'log-out-outline' as keyof typeof Ionicons.glyphMap,
            color: theme.colors.primary,
          }
        : null,
      baseFim && (!baseInicio || baseFim.id !== baseInicio.id)
        ? {
            label: 'Chegada',
            value: baseFim.endereco,
            icon: 'log-in-outline' as keyof typeof Ionicons.glyphMap,
            color: theme.colors.secondary,
          }
        : null,
    ].filter(Boolean) as Array<{
      label: string;
      value: string;
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
    }>;

    return (
      <View style={styles.baseInfoList}>
        {entries.map((entry, index) => (
          <View key={`${entry.label}-${index}`} style={styles.baseInfoItemRow}>
            <View
              style={[
                styles.baseInfoIcon,
                { backgroundColor: `${entry.color}22` },
              ]}
            >
              <Ionicons name={entry.icon} size={18} color={entry.color} />
            </View>
            <View style={styles.baseInfoTexts}>
              <Text style={styles.baseInfoLabel}>{entry.label}</Text>
              <Text style={styles.baseInfoValue}>{entry.value}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const resumoItems = [
    {
      label: 'Paradas Totais',
      value: resumoParadas.total,
      color: theme.colors.gray900,
      icon: 'flag-outline' as keyof typeof Ionicons.glyphMap,
      bg: theme.colors.primaryBg,
    },
    {
      label: 'Concluidas',
      value: resumoParadas.concluidas,
      color: theme.colors.success,
      icon: 'checkmark-done-outline' as keyof typeof Ionicons.glyphMap,
      bg: theme.colors.successBg,
    },
    {
      label: 'Pendentes',
      value: resumoParadas.pendentes,
      color: theme.colors.warning,
      icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
      bg: theme.colors.warningBg,
    },
  ];

  const ResumoStats = ({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) => {
    if (variant === 'desktop') {
      return (
        <View style={styles.resumoDesktopGrid}>
          {resumoItems.map((item) => (
            <View key={item.label} style={styles.resumoDesktopItem}>
              <View
                style={[
                  styles.resumoIconWrapper,
                  { backgroundColor: item.bg, borderColor: `${item.color}33` },
                ]}
              >
                <Ionicons name={item.icon} size={16} color={item.color} />
              </View>
              <Text style={[styles.resumoDesktopValue, { color: item.color }]}>
                {item.value}
              </Text>
              <Text style={styles.resumoDesktopLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.resumoStats}>
        {resumoItems.map((item) => (
          <View key={item.label} style={styles.resumoStat}>
            <Text
              style={[
                styles.resumoStatValue,
                item.color === theme.colors.success && styles.resumoStatValueSuccess,
                item.color === theme.colors.warning && styles.resumoStatValueWarning,
              ]}
            >
              {item.value}
            </Text>
            <Text style={styles.resumoStatLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Componente Lista de Paradas reutilizavel
  const ParadasList = ({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) => (
    <View style={styles.paradasContainer}>
      {variant === 'mobile' && (
        <Text style={styles.paradasTitle}>
          Paradas ({resumoParadas.total})
        </Text>
      )}

      {paradasReais.length === 0 ? (
        <View style={styles.emptyParadas}>
          <Text style={styles.emptyParadasText}>
            Nenhuma entrega ou retirada registrada para esta rota.
          </Text>
        </View>
      ) : (
        paradasReais.map((parada, index) =>(
          <View key={parada.id} style={styles.paradaCard}>
            <View style={styles.paradaHeader}>
              <View style={styles.paradaNumero}>
                <Text style={styles.paradaNumeroText}>{index + 1}</Text>
              </View>
              <View style={styles.paradaHeaderInfo}>
                <Text style={styles.paradaEndereco}>{parada.endereco}</Text>
                <View style={styles.paradaTags}>
                  <View style={[
                    styles.tipoTag,
                    parada.tipo === 'entrega' ? styles.tipoTagEntrega : styles.tipoTagRetirada,
                  ]}>
                    <Text style={styles.tipoTagText}>
                      {parada.tipo === 'entrega' ? 'Entrega' : 'Retirada'}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusTag,
                    parada.status === 'concluida' && styles.statusTagConcluida,
                    parada.status === 'pendente' && styles.statusTagPendente,
                    parada.status === 'em_andamento' && styles.statusTagEmAndamento,
                  ]}>
                    <Text style={styles.statusTagText}>
                      {parada.status === 'concluida' && 'Concluida'}
                      {parada.status === 'pendente' && 'Pendente'}
                      {parada.status === 'em_andamento' && 'Em andamento'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {(parada.destinatario || parada.telefone || parada.observacoes) && (
              <View style={styles.paradaDetalhes}>
                {parada.destinatario && (
                  <View style={styles.paradaMetaRow}>
                    <Text style={styles.paradaMetaLabel}>Destinatario</Text>
                    <Text style={styles.paradaMetaValue}>{parada.destinatario}</Text>
                  </View>
                )}
                {parada.telefone && (
                  <View style={styles.paradaMetaRow}>
                    <Text style={styles.paradaMetaLabel}>Telefone</Text>
                    <Text style={styles.paradaMetaValue}>{parada.telefone}</Text>
                  </View>
                )}
                {parada.observacoes && (
                  <View style={styles.paradaMetaRow}>
                    <Text style={styles.paradaMetaLabel}>Observacoes</Text>
                    <Text style={styles.paradaMetaValue}>{parada.observacoes}</Text>
                  </View>
                )}
              </View>
            )}

            {parada.latitude && parada.longitude && (
              <View style={styles.paradaMetaRow}>
                <Text style={styles.paradaMetaLabel}>Coordenadas</Text>
                <Text style={styles.paradaMetaValue}>
                  {parada.latitude.toFixed(6)}, {parada.longitude.toFixed(6)}
                </Text>
              </View>
            )}

            {parada.foto_url && (
              <View style={styles.fotoContainer}>
                <Text style={styles.fotoLabel}>Comprovante de Entrega:</Text>
                <TouchableOpacity
                  onPress={() =>{
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
        ))
      )}

      {variant === 'mobile' && hasBaseInfo && (
        <View style={styles.baseInfoCard}>
          <Text style={styles.baseInfoTitle}>Pontos da Unidade</Text>
          <BaseInfoContent />
        </View>
      )}

      {variant === 'mobile' && (
        <View style={styles.resumo}>
          <Text style={styles.resumoTitle}>Resumo da Rota</Text>
          <ResumoStats />
        </View>
      )}
    </View>
  );

  // Render principal

  // Desktop Layout
  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          headerExtra={
            rota ? (
              <View style={styles.headerInfo}>
                <Text style={styles.headerInfoName}>{rota.motorista?.nome || 'Sem motorista'}</Text>
                <Text style={styles.headerInfoSub}>{formatarDataLocal(rota.data)}</Text>
              </View>
            ) : undefined
          }
          actions={[
            {
              label: 'Voltar',
              icon: 'arrow-back-outline',
              onPress: () =>router.back(),
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
                <View
                  style={[
                    styles.statusBadge,
                    styles.statusBadgeDesktop,
                    statusBadgeVariant.container,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      styles.statusBadgeTextDesktop,
                      statusBadgeVariant.text,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {rota!.distancia_total && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: theme.colors.gray600 }}>Distancia Total:</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.gray900, fontWeight: '600' }}>
                    {rota!.distancia_total.toFixed(1)} km
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.colors.gray600 }}>Paradas:</Text>
                <Text style={{ fontSize: 14, color: theme.colors.gray900, fontWeight: '600' }}>
                  {resumoParadas.total >0
                    ? `${resumoParadas.concluidas}/${resumoParadas.total} concluidas`
                    : 'Sem entregas'}
                </Text>
              </View>
            </View>
          </View>

          {/* Split View: Mapa | Lista de Paradas */}
          {paradas.length >0 ? (
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
                  subtitle={
                    resumoParadas.total >0
                      ? `${resumoParadas.total} paradas na rota`
                      : 'Nenhuma entrega ou retirada'
                  }
                  icon="list-outline"
                  iconColor={theme.colors.secondary}
                  variant="outlined"
                >
                  <ScrollView style={{ maxHeight: 600 }}>
                    <ParadasList variant="desktop" />
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

          <View style={styles.desktopInfoRow}>
            <View style={styles.desktopInfoColumn}>
              <DesktopCard
                title="Pontos da Unidade"
                icon="business-outline"
                iconColor={theme.colors.secondary}
                variant="outlined"
              >
                <BaseInfoContent />
                {hasBaseInfo && (
                  <TouchableOpacity
                    style={styles.baseInfoLink}
                    onPress={() => router.push('/unidade')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.baseInfoLinkText}>Ver cadastro da unidade</Text>
                    <Ionicons name="arrow-forward-outline" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </DesktopCard>
            </View>
            <View style={styles.desktopInfoColumnWide}>
              <DesktopCard
                title="Resumo da Rota"
                icon="analytics-outline"
                iconColor={theme.colors.primary}
                variant="outlined"
              >
                <ResumoStats variant="desktop" />
                <Text style={styles.resumoUpdated}>Atualizado em {formatarDataHora(rota.updated_at)}</Text>
              </DesktopCard>
            </View>
          </View>
        </DesktopPageLayout>

        {/* Modal para foto - Desktop */}
        <DesktopModal
          visible={fotoModalVisible}
          onClose={() =>setFotoModalVisible(false)}
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
        {logoutModal}
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
              onPress={() =>router.back()}
              style={styles.backLink}
              accessibilityLabel="Voltar para tela anterior"
              accessibilityRole="button"
            >
              <Text style={styles.backLinkText}>{'<-'} Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mapa da Rota</Text>
            <Text style={styles.headerSubtitle}>
              {rota?.motorista?.nome || 'Sem motorista'}  {formatarDataLocal(rota?.data)}
            </Text>
          </View>
        </View>

        {/* Rota Info */}
        <View style={styles.rotaInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={[styles.statusBadge, statusBadgeVariant.container]}>
              <Text style={[styles.statusBadgeText, statusBadgeVariant.text]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          {rota!.distancia_total && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Distancia Total:</Text>
              <Text style={styles.infoValue}>{rota!.distancia_total.toFixed(1)} km</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
        {paradas.length >0 ? (
          <>
            <MapView />
            <ParadasList variant="mobile" />
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
        onRequestClose={() =>setFotoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            onPress={() =>setFotoModalVisible(false)}
            activeOpacity={1}
          >
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() =>setFotoModalVisible(false)}
              >
                <Text style={styles.modalCloseButtonText}>x</Text>
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
      {logoutModal}
    </>
  );
}

const styles = StyleSheet.create(theme =>({
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
  desktopInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing['2xl'],
    marginTop: theme.spacing['2xl'],
    alignItems: 'stretch',
  },
  desktopInfoColumn: {
    flexBasis: '40%',
    flexGrow: 1,
    minWidth: 280,
  },
  desktopInfoColumnWide: {
    flexBasis: '55%',
    flexGrow: 1,
    minWidth: 320,
  },
  baseInfoList: {
    gap: theme.spacing.md,
  },
  baseInfoItemRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'flex-start',
  },
  baseInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseInfoTexts: {
    flex: 1,
  },
  baseInfoLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  baseInfoValue: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray900,
    marginTop: 2,
  },
  baseInfoEmpty: {
    fontSize: theme.typography.sm,
    color: theme.colors.gray500,
  },
  baseInfoLink: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  baseInfoLinkText: {
    fontSize: theme.typography.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontSansSemiBold,
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.gray100,
  },
  statusBadgeDesktop: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
  },
  statusBadgeText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  statusBadgeTextDesktop: {
    fontSize: theme.typography.sm,
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
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  paradaMetaRow: {
    marginBottom: theme.spacing.xs,
  },
  paradaMetaLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paradaMetaValue: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.gray900,
    marginTop: 2,
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
  resumoStatValueSuccess: {
    color: theme.colors.success,
  },
  resumoStatValueWarning: {
    color: theme.colors.warning,
  },
  resumoStatLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  resumoDesktopGrid: {
    flexDirection: 'row',
    gap: theme.spacing['2xl'],
  },
  resumoDesktopItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  resumoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumoDesktopValue: {
    fontFamily: theme.typography.fontDisplay,
    fontSize: theme.typography.fontSize['2xl'],
  },
  resumoDesktopLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resumoUpdated: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
  },
  baseInfoCard: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.primaryBg,
  },
  baseInfoTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  baseInfoItem: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray700,
    marginBottom: theme.spacing.xs,
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
    backgroundColor: theme.colors.warning,
    borderWidth: 3,
    borderColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerBadgeConcluida: {
    backgroundColor: theme.colors.success,
  },
  markerBadgeEmAndamento: {
    backgroundColor: theme.colors.info,
  },
  markerText: {
    color: theme.colors.white,
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


















