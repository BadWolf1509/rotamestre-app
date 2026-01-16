/**
 * Mapa da Rota - Página de visualização de rota do gestor
 * Layout otimizado baseado em melhores práticas SaaS 2024/2025
 *
 * Modular architecture:
 * - hooks/useMapaRotaData.ts: Data loading and computed values
 * - hooks/useMapaRotaHandlers.ts: Action handlers
 * - hooks/useMapaRotaModals.ts: Modal state management
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Platform } from 'react-native';

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
  ChangeDriverModal,
  EditStopModal,
  AddStopModal,
  DraggableStopList,
  getStatusBadgeVariant,
  formatStatusLabel,
  styles,
} from '@/components/gestor/mapa-rota';
import type { DraggableStopListControl } from '@/components/gestor/mapa-rota';
import {
  useMapaRotaData,
  useMapaRotaHandlers,
  useMapaRotaModals,
} from '@/components/gestor/mapa-rota/hooks';
import { MapaAdapter } from '@/components/MapaAdapter';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  Button,
  DesktopCard,
  DesktopModal,
  DesktopPageLayout,
  Dialog,
  SplitView,
  Text,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useResponsive } from '@/hooks/useResponsive';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { formatDateBR } from '@/lib/dateUtils';
import { useUnistyles } from '@/utils/styles';

// Optimized map height
const OPTIMIZED_MAP_HEIGHT = 480;

export default function MapaRota() {
  const { theme } = useUnistyles();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { toast, hideToast } = useToast();
  const { isDesktop } = useResponsive();
  const { userData } = useUser();
  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  // Ref for reorder control
  const reorderControlRef = useRef<DraggableStopListControl | null>(null);

  // Constants
  const pageMeta = getGestorPageMeta('mapaRota');

  // Memoized error handler to prevent infinite re-render loop
  const handleDataError = useCallback(() => router.back(), [router]);

  // ===== Data Hook =====
  const {
    loading,
    rota,
    paradas,
    paradasReais,
    pontosBase,
    resumoParadas,
    enderecoUnidade,
    loadRotaEParadas,
  } = useMapaRotaData({
    rotaId: id,
    onError: handleDataError,
  });

  // ===== Handlers Hook =====
  const {
    selectedParadaId,
    fotoSelecionada,
    paradaToRemove,
    paradaToEdit,
    isReordering,
    hasReorderChanges,
    setHasReorderChanges,
    listaParadasRef,
    handleMarkerPress,
    handleMapPress,
    handleParadaPress,
    handleParadaLayout,
    handleImagePress,
    clearFotoSelecionada,
    handleConfirmCancel,
    handleConfirmReactivate,
    handleChangeDriver,
    handleRemoveStopRequest,
    handleConfirmRemoveStop,
    clearParadaToRemove,
    handleEditStop,
    handleEditStopSave,
    clearParadaToEdit,
    handleAddStopSave,
    handleReorderParadas,
  } = useMapaRotaHandlers({
    rotaId: id,
    rota,
    paradas,
    paradasReais,
    enderecoUnidade,
    loadRotaEParadas,
  });

  // ===== Modal State Hook =====
  const modals = useMapaRotaModals();

  // ===== Computed Values =====
  const statusBadgeVariant = useMemo(
    () => getStatusBadgeVariant(theme, rota?.status),
    [theme, rota?.status]
  );
  const statusLabel = useMemo(() => formatStatusLabel(rota?.status), [rota?.status]);
  const hasBaseInfo = useHasBaseInfo(pontosBase);

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

            <Button
              title="Ver Minhas Rotas"
              variant="primary"
              onPress={() => router.push('/gestor/gestao-rotas')}
              style={styles.primaryButton}
              fullWidth
            />

            <Text style={styles.emptyStateOr}>Ou crie uma nova rota:</Text>

            <Button
              title="Nova Rota"
              variant="outline"
              onPress={() => router.push('/gestor/nova-entrega')}
              style={styles.secondaryButton}
              fullWidth
            />
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
          <Button
            title="Voltar"
            variant="primary"
            onPress={() => router.back()}
            style={styles.backButton}
          />
        </View>
        {logoutModal}
      </>
    );
  }

  // ===== Desktop Layout =====
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
          {/* Compact Header */}
          <RouteInfoHeaderCompact
            rota={rota}
            resumoParadas={resumoParadas}
            onCancelPress={modals.openCancelModal}
            onReactivatePress={modals.openReactivateModal}
            onChangeDriverPress={modals.openChangeDriverModal}
            onAddStopPress={modals.openAddStopModal}
            onReorderPress={modals.openReorderModal}
          />

          {/* Split View: Map | Stops */}
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
                  <View style={{ height: OPTIMIZED_MAP_HEIGHT }} testID="gestor-mapa-view">
                    <MapaAdapter
                      paradas={paradas}
                      selectedParadaId={selectedParadaId}
                      onMarkerPress={handleMarkerPress}
                      onMapPress={handleMapPress}
                      rotaId={rota?.id}
                      motoristaNome={rota?.motorista?.nome}
                      showMotorista={rota?.status === 'em_andamento'}
                      unidadeNome={rota?.unidade?.nome}
                    />
                  </View>
                </DesktopCard>
              }
              right={
                <View style={{ gap: 12, flex: 1 }}>
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
                            rotaStatus={rota?.status}
                            onRemove={handleRemoveStopRequest}
                            onEdit={handleEditStop}
                          />
                        ))
                      )}
                    </ScrollView>

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

          {/* Collapsible Timeline */}
          <View style={{ marginTop: 16 }}>
            <TimelineCollapsible rotaId={id as string} rotaCreatedAt={rota?.created_at} />
          </View>

          {/* Unit Base Points */}
          {hasBaseInfo && (
            <View style={{ marginTop: 16 }}>
              <DesktopCard
                title="Pontos da Unidade"
                icon="business-outline"
                iconColor={theme.colors.secondary}
                variant="outlined"
              >
                <BaseInfoContent pontosBase={pontosBase} />
                <Button
                  title="Ver cadastro da unidade"
                  icon="arrow-forward-outline"
                  iconPosition="right"
                  variant="ghost"
                  onPress={() => router.push('/unidade')}
                  style={styles.baseInfoLink}
                />
              </DesktopCard>
            </View>
          )}
        </DesktopPageLayout>

        {/* Modals */}
        <PhotoModal
          visible={!!fotoSelecionada}
          photoUrl={fotoSelecionada}
          onClose={clearFotoSelecionada}
        />

        <Dialog
          visible={modals.showCancelModal}
          variant="confirm"
          title="Cancelar rota"
          message="Tem certeza que deseja cancelar esta rota? Esta ação não pode ser desfeita."
          confirmText="Sim, cancelar"
          cancelText="Não"
          onConfirm={async () => {
            await handleConfirmCancel();
            modals.closeCancelModal();
          }}
          onCancel={modals.closeCancelModal}
          type="danger"
        />

        <Dialog
          visible={modals.showReactivateModal}
          variant="confirm"
          title="Reativar rota"
          message="Deseja reativar esta rota expirada? A rota será reprogramada para hoje e as paradas não concluídas voltarão ao status pendente."
          confirmText="Sim, reativar"
          cancelText="Cancelar"
          onConfirm={async () => {
            await handleConfirmReactivate();
            modals.closeReactivateModal();
          }}
          onCancel={modals.closeReactivateModal}
          type="success"
        />

        <ChangeDriverModal
          visible={modals.showChangeDriverModal}
          currentMotoristaId={rota.motorista_id}
          currentMotoristaNome={rota.motorista?.nome}
          unidadeId={rota.unidade_id || ''}
          onConfirm={async (newId, newNome) => {
            await handleChangeDriver(newId, newNome);
            modals.closeChangeDriverModal();
          }}
          onCancel={modals.closeChangeDriverModal}
        />

        <Dialog
          visible={modals.showRemoveStopModal && !!paradaToRemove}
          variant="confirm"
          title="Remover parada"
          message={`Tem certeza que deseja remover esta parada?\n\n${paradaToRemove?.endereco || ''}\n\nA rota será recalculada automaticamente.`}
          confirmText="Sim, remover"
          cancelText="Cancelar"
          onConfirm={async () => {
            await handleConfirmRemoveStop();
            modals.closeRemoveStopModal();
          }}
          onCancel={() => {
            modals.closeRemoveStopModal();
            clearParadaToRemove();
          }}
          type="danger"
        />

        <EditStopModal
          visible={modals.showEditStopModal && !!paradaToEdit}
          parada={paradaToEdit}
          rotaId={Array.isArray(id) ? id[0] : id || ''}
          enderecoUnidade={enderecoUnidade}
          allParadas={paradasReais}
          onSave={async () => {
            await handleEditStopSave();
            modals.closeEditStopModal();
          }}
          onCancel={() => {
            modals.closeEditStopModal();
            clearParadaToEdit();
          }}
          usuarioId={userData?.id}
          motoristaId={rota?.motorista_id}
        />

        <AddStopModal
          visible={modals.showAddStopModal}
          rotaId={Array.isArray(id) ? id[0] : id || ''}
          enderecoUnidade={enderecoUnidade}
          currentParadasCount={paradasReais.length}
          allParadas={paradasReais}
          onSave={async () => {
            await handleAddStopSave();
            modals.closeAddStopModal();
          }}
          onCancel={modals.closeAddStopModal}
          usuarioId={userData?.id}
          motoristaId={rota?.motorista_id}
        />

        <DesktopModal
          visible={modals.showReorderModal}
          onClose={() => {
            if (hasReorderChanges) {
              modals.openReorderConfirmClose();
            } else {
              modals.closeReorderModal();
            }
          }}
          title="Reordenar Paradas"
          maxWidth={500}
          primaryButton={
            Platform.OS === 'web'
              ? {
                  text: 'Salvar',
                  onPress: () => reorderControlRef.current?.saveChanges(),
                  loading: isReordering,
                  disabled: !hasReorderChanges,
                }
              : undefined
          }
          secondaryButton={
            Platform.OS === 'web'
              ? {
                  text: 'Cancelar',
                  onPress: () => {
                    reorderControlRef.current?.cancelChanges();
                    setHasReorderChanges(false);
                  },
                  disabled: isReordering || !hasReorderChanges,
                }
              : undefined
          }
        >
          <DraggableStopList
            paradas={paradas}
            onReorder={async (newOrder) => {
              await handleReorderParadas(newOrder);
              modals.closeReorderModal();
            }}
            rotaStatus={rota?.status || ''}
            isLoading={isReordering}
            onWebChangesChange={setHasReorderChanges}
            controlRef={reorderControlRef}
          />
        </DesktopModal>

        <Dialog
          visible={modals.showReorderConfirmClose}
          variant="confirm"
          title="Descartar Alterações?"
          message="Você tem alterações não salvas na ordem das paradas. Deseja descartá-las?"
          type="warning"
          confirmText="Descartar"
          cancelText="Voltar"
          onConfirm={() => {
            reorderControlRef.current?.cancelChanges();
            setHasReorderChanges(false);
            modals.closeReorderConfirmClose();
            modals.closeReorderModal();
          }}
          onCancel={modals.closeReorderConfirmClose}
        />

        <Toast {...toast} onDismiss={hideToast} />
        {logoutModal}
      </>
    );
  }

  // ===== Mobile Layout =====
  return (
    <>
      <View style={styles.rotaInfo}>
        <Text style={styles.motoristaData}>
          {rota?.motorista?.nome || 'Sem motorista'}  {formatDateBR(rota?.data)}
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

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {paradas.length > 0 ? (
            <>
              <View style={styles.mapContainer} testID="gestor-mapa-view">
                <MapaAdapter
                  paradas={paradas}
                  selectedParadaId={selectedParadaId}
                  onMarkerPress={handleMarkerPress}
                  onMapPress={handleMapPress}
                  rotaId={rota?.id}
                  motoristaNome={rota?.motorista?.nome}
                  showMotorista={rota?.status === 'em_andamento'}
                  unidadeNome={rota?.unidade?.nome}
                />
              </View>

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

      <PhotoModal
        visible={!!fotoSelecionada}
        photoUrl={fotoSelecionada}
        onClose={clearFotoSelecionada}
      />

      <Toast {...toast} onDismiss={hideToast} />
      {logoutModal}
    </>
  );
}
