/**
 * Mapa da Rota - Página de visualização de rota do gestor
 * Layout otimizado baseado em melhores práticas SaaS 2024/2025
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

import { ConfirmModal } from '@/components/ConfirmModal';
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { SplitView } from '@/components/desktop/SplitView';
import {
  ParadaCard,
  ParadaCardCompact,
  ResumoStats,
  ResumoInline,
  BaseInfoContent,
  useHasBaseInfo,
  RouteInfoHeaderCompact,
  PhotoModal,
  MapaRotaSkeleton,
  TimelineCollapsible,
  getStatusBadgeVariant,
  formatStatusLabel,
  styles,
} from '@/components/gestor/mapa-rota';
import type { Parada, Rota, ResumoParadas } from '@/components/gestor/mapa-rota';
import { MapaAdapter } from '@/components/MapaAdapter';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import { useUnistyles } from '@/utils/styles';

// Altura otimizada do mapa (menor que antes para mais espaço às paradas)
const OPTIMIZED_MAP_HEIGHT = 480;

// ===== Utility Functions =====

function formatarDataLocal(dateStr?: string, locale = 'pt-BR'): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '-';
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale);
}

// ===== Main Component =====

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

  // State
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);

  // Refs
  const listaParadasRef = useRef<ScrollView | null>(null);
  const paradaPositions = useRef<Record<string, number>>({});

  // Constants
  const pageMeta = getGestorPageMeta('mapaRota');

  // Memoized values
  const statusBadgeVariant = useMemo(
    () => getStatusBadgeVariant(theme, rota?.status),
    [theme, rota?.status]
  );
  const statusLabel = useMemo(() => formatStatusLabel(rota?.status), [rota?.status]);

  const paradasReais = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint !== false),
    [paradas]
  );

  const pontosBase = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint === false),
    [paradas]
  );

  const hasBaseInfo = useHasBaseInfo(pontosBase);

  const resumoParadas: ResumoParadas = useMemo(() => {
    const total = paradasReais.length;
    const concluidas = paradasReais.filter((p) => p.status === 'concluida').length;
    const pendentes = paradasReais.filter((p) => p.status === 'pendente').length;
    const emAndamento = paradasReais.filter((p) => p.status === 'em_andamento').length;
    return { total, concluidas, pendentes, emAndamento };
  }, [paradasReais]);

  // Callbacks
  const loadRotaEParadas = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const { data: rotaData, error: rotaError } = await supabase
        .from('rotas')
        .select('id, data, status, distancia_total, updated_at, usuarios!rotas_motorista_id_fkey(nome)')
        .eq('id', id)
        .single();

      if (rotaError) throw rotaError;

      setRota({
        ...rotaData,
        motorista: Array.isArray(rotaData.usuarios) ? rotaData.usuarios[0] : rotaData.usuarios,
      });

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

  const handleConfirmCancel = useCallback(async () => {
    if (!id) return;
    try {
      const rotaId = Array.isArray(id) ? id[0] : id;
      await supabase.from('rotas').update({ status: 'cancelada' }).eq('id', rotaId);
      showToast('Rota cancelada com sucesso', 'success');
      setShowCancelModal(false);
      await loadRotaEParadas();
    } catch (error) {
      console.error('Erro ao cancelar rota:', error);
      showToast('Erro ao cancelar rota', 'error');
    }
  }, [id, loadRotaEParadas, showToast]);

  const handleConfirmReactivate = useCallback(async () => {
    if (!id) return;
    try {
      const rotaId = Array.isArray(id) ? id[0] : id;

      // Obter data de hoje no formato YYYY-MM-DD
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Reativar a rota: status volta para pendente, data atualizada para hoje
      await supabase
        .from('rotas')
        .update({
          status: 'pendente',
          data: todayStr,
          iniciada_em: null,
          concluida_em: null,
        })
        .eq('id', rotaId);

      // Resetar status das paradas pendentes
      await supabase
        .from('paradas')
        .update({ status: 'pendente', concluida_em: null })
        .eq('rota_id', rotaId)
        .neq('status', 'concluida');

      // Registrar log da reativação
      await supabase.from('logs').insert({
        usuario_id: userData?.id,
        rota_id: rotaId,
        evento: 'rota_reativada',
        detalhes: {
          nova_data: todayStr,
          reativado_por: userData?.nome,
        },
      });

      showToast('Rota reativada com sucesso', 'success');
      setShowReactivateModal(false);
      await loadRotaEParadas();
    } catch (error) {
      console.error('Erro ao reativar rota:', error);
      showToast('Erro ao reativar rota', 'error');
    }
  }, [id, loadRotaEParadas, showToast, userData?.id, userData?.nome]);

  const scrollToParada = useCallback((paradaId: string) => {
    const positionY = paradaPositions.current[paradaId];
    if (positionY != null && listaParadasRef.current) {
      listaParadasRef.current.scrollTo({ y: Math.max(positionY - 12, 0), animated: true });
    }
  }, []);

  const handleMarkerPress = useCallback(
    (paradaId: string) => {
      setSelectedParadaId(paradaId);
      scrollToParada(paradaId);
    },
    [scrollToParada]
  );

  const handleParadaPress = useCallback((paradaId: string) => {
    setSelectedParadaId(paradaId);
  }, []);

  const handleParadaLayout = useCallback((idParada: string, y: number) => {
    paradaPositions.current[idParada] = y;
  }, []);

  const handleImagePress = useCallback((url: string) => {
    setFotoSelecionada(url);
  }, []);

  // Effects
  useEffect(() => {
    if (id) {
      loadRotaEParadas();
    } else {
      setLoading(false);
    }
  }, [id, loadRotaEParadas]);

  // ===== Loading State =====

  if (loading) {
    return (
      <>
        <MapaRotaSkeleton
          isDesktop={isDesktop}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
        />
        {logoutModal}
      </>
    );
  }

  // ===== Empty State (No ID) =====

  if (!id) {
    return (
      <>
        <View style={styles.emptyStateContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.emptyStateBackLink}>
            <Text style={styles.backLinkText}>{'<-'} Voltar</Text>
          </TouchableOpacity>

          <View style={styles.emptyStateContent}>
            <Text style={styles.emptyStateIcon}>*</Text>
            <Text style={styles.emptyStateTitle}>Nenhuma Rota Selecionada</Text>
            <Text style={styles.emptyStateDescription}>
              Você precisa selecionar uma rota para visualizar o mapa e paradas.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/gestor/gestao-rotas')}
            >
              <Text style={styles.primaryButtonText}>* Ver Minhas Rotas</Text>
            </TouchableOpacity>

            <Text style={styles.emptyStateOr}>Ou crie uma nova rota:</Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/gestor/nova-entrega')}
            >
              <Text style={styles.secondaryButtonText}>+ Nova Rota</Text>
            </TouchableOpacity>
          </View>
        </View>
        {logoutModal}
      </>
    );
  }

  // ===== Error State (No Route) =====

  if (!rota) {
    return (
      <>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Rota não encontrada</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
        {logoutModal}
      </>
    );
  }

  // ===== Desktop Layout (Otimizado) =====

  if (isDesktop) {
    return (
      <>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          fullWidth
          noPadding
        >
          {/* Header Compacto */}
          <RouteInfoHeaderCompact
            rota={rota}
            resumoParadas={resumoParadas}
            onCancelPress={() => setShowCancelModal(true)}
            onReactivatePress={() => setShowReactivateModal(true)}
          />

          {/* Split View: Mapa | Paradas */}
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
                  <View style={{ height: OPTIMIZED_MAP_HEIGHT }}>
                    <MapaAdapter
                      paradas={paradas}
                      selectedParadaId={selectedParadaId}
                      onMarkerPress={handleMarkerPress}
                      rotaId={rota?.id}
                      motoristaNome={rota?.motorista?.nome}
                      showMotorista={rota?.status === 'em_andamento'}
                    />
                  </View>
                </DesktopCard>
              }
              right={
                <View style={{ gap: 12, flex: 1 }}>
                  {/* Lista de Paradas Compacta */}
                  <DesktopCard
                    title="Paradas"
                    icon="list-outline"
                    iconColor={theme.colors.secondary}
                    variant="outlined"
                  >
                    <ScrollView
                      style={{ maxHeight: OPTIMIZED_MAP_HEIGHT - 80 }}
                      ref={listaParadasRef}
                      showsVerticalScrollIndicator={false}
                    >
                      {paradasReais.length === 0 ? (
                        <View style={styles.emptyParadas}>
                          <Text style={styles.emptyParadasText}>
                            Nenhuma entrega ou retirada registrada.
                          </Text>
                        </View>
                      ) : (
                        paradasReais.map((parada, index) => (
                          <ParadaCardCompact
                            key={parada.id}
                            parada={parada}
                            index={index}
                            onImagePress={handleImagePress}
                            selected={selectedParadaId === parada.id}
                            onPress={handleParadaPress}
                            onLayoutCapture={handleParadaLayout}
                          />
                        ))
                      )}
                    </ScrollView>

                    {/* Resumo Inline */}
                    {paradasReais.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <ResumoInline resumoParadas={resumoParadas} />
                      </View>
                    )}
                  </DesktopCard>
                </View>
              }
              leftFlex={1.2}
              rightFlex={1}
              gap={20}
            />
          ) : (
            <DesktopCard variant="outlined">
              <View style={styles.emptyParadas}>
                <Text style={styles.emptyParadasText}>Nenhuma parada nesta rota</Text>
              </View>
            </DesktopCard>
          )}

          {/* Timeline Colapsável no Rodapé */}
          <View style={{ marginTop: 16 }}>
            <TimelineCollapsible rotaId={id as string} />
          </View>

          {/* Pontos da Unidade (apenas se houver) */}
          {hasBaseInfo && (
            <View style={{ marginTop: 16 }}>
              <DesktopCard
                title="Pontos da Unidade"
                icon="business-outline"
                iconColor={theme.colors.secondary}
                variant="outlined"
              >
                <BaseInfoContent pontosBase={pontosBase} />
                <TouchableOpacity
                  style={styles.baseInfoLink}
                  onPress={() => router.push('/unidade')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.baseInfoLinkText}>Ver cadastro da unidade</Text>
                  <Ionicons name="arrow-forward-outline" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
              </DesktopCard>
            </View>
          )}
        </DesktopPageLayout>

        {/* Photo Modal */}
        <PhotoModal
          visible={!!fotoSelecionada}
          photoUrl={fotoSelecionada}
          onClose={() => setFotoSelecionada(null)}
          isDesktop={true}
        />

        {/* Cancel Confirmation Modal */}
        <ConfirmModal
          visible={showCancelModal}
          title="Cancelar rota"
          message="Tem certeza que deseja cancelar esta rota? Esta ação não pode ser desfeita."
          confirmText="Sim, cancelar"
          cancelText="Não"
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelModal(false)}
          type="danger"
        />

        {/* Reactivate Confirmation Modal */}
        <ConfirmModal
          visible={showReactivateModal}
          title="Reativar rota"
          message="Deseja reativar esta rota expirada? A rota será reprogramada para hoje e as paradas não concluídas voltarão ao status pendente."
          confirmText="Sim, reativar"
          cancelText="Cancelar"
          onConfirm={handleConfirmReactivate}
          onCancel={() => setShowReactivateModal(false)}
          type="success"
        />

        <Toast {...toast} onDismiss={hideToast} />
        {logoutModal}
      </>
    );
  }

  // ===== Mobile Layout =====

  return (
    <>
      {/* Route Info */}
      <View style={styles.rotaInfo}>
        <Text style={styles.motoristaData}>
          {rota?.motorista?.nome || 'Sem motorista'}  {formatarDataLocal(rota?.data)}
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <View style={[styles.statusBadge, statusBadgeVariant.container]}>
            <Text style={[styles.statusBadgeText, statusBadgeVariant.text]}>{statusLabel}</Text>
          </View>
        </View>
        {rota.distancia_total && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distancia Total:</Text>
            <Text style={styles.infoValue}>{rota.distancia_total.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {paradas.length > 0 ? (
            <>
              <View style={styles.mapContainer}>
                <MapaAdapter
                  paradas={paradas}
                  selectedParadaId={selectedParadaId}
                  onMarkerPress={handleMarkerPress}
                  rotaId={rota?.id}
                  motoristaNome={rota?.motorista?.nome}
                  showMotorista={rota?.status === 'em_andamento'}
                />
              </View>

              {/* Lista de Paradas */}
              <View style={styles.paradasContainer}>
                <Text style={styles.paradasTitle}>Paradas ({resumoParadas.total})</Text>

                {paradasReais.map((parada, index) => (
                  <ParadaCard
                    key={parada.id}
                    parada={parada}
                    index={index}
                    onImagePress={handleImagePress}
                    selected={selectedParadaId === parada.id}
                    onPress={handleParadaPress}
                    onLayoutCapture={handleParadaLayout}
                  />
                ))}

                {hasBaseInfo && (
                  <View style={styles.baseInfoCard}>
                    <Text style={styles.baseInfoTitle}>Pontos da Unidade</Text>
                    <BaseInfoContent pontosBase={pontosBase} />
                  </View>
                )}

                <View style={styles.resumo}>
                  <Text style={styles.resumoTitle}>Resumo da Rota</Text>
                  <ResumoStats resumoParadas={resumoParadas} />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.emptyParadas}>
              <Text style={styles.emptyParadasText}>Nenhuma parada nesta rota</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <PhotoModal
        visible={!!fotoSelecionada}
        photoUrl={fotoSelecionada}
        onClose={() => setFotoSelecionada(null)}
        isDesktop={false}
      />

      <Toast {...toast} onDismiss={hideToast} />
      {logoutModal}
    </>
  );
}
