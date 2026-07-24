import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  FormularioParada,
  ParadasListAndActions,
  RouteReviewModal,
  novaEntregaStyles as styles,
} from '@/components/gestor/nova-entrega';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DesktopCard,
  DesktopPageLayout,
  MobileCard,
  MobileLoading,
  Toast,
} from '@/design-system';
import { useAlert } from '@/hooks/useAlert';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useNovaEntrega } from '@/hooks/useNovaEntrega';
import { useResponsive } from '@/hooks/useResponsive';
import { useUnistyles } from '@/utils/styles';

export default function NovaEntrega() {
  const { theme } = useUnistyles();
  const { isDesktop, isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const pageMeta = getGestorPageMeta('novaRota');
  const { showConfirm, AlertDialog } = useAlert();
  const [reviewVisible, setReviewVisible] = useState(false);
  const [hasValidCoordinates, setHasValidCoordinates] = useState(false);

  const novaEntrega = useNovaEntrega();
  const {
    form,
    paradas,
    motoristas,
    motoristaSelecionado,
    vinculoSelecionado,
    dataRota,
    setDataRota,
    isLoading,
    isLoadingMotoristas,
    isLoadingEndereco,
    isOptimizing,
    isDraftHydrating,
    isDraftSaving,
    draftLastSavedAt,
    draftSaveError,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    isCalculandoReal,
    enderecoUnidade,
    retiradasDisponiveis,
    paradasStatus,
    routeValidation,
    canGenerateRoute,
    editingParada,
    toastState,
    showToast,
    hideToast,
    setMotoristaSelecionado,
    setVinculoSelecionado,
    onAddParada,
    importParadas,
    startEditParada,
    cancelEditParada,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    reorderParadas,
    otimizarRota,
    gerarRota,
    limparFormulario,
    findDuplicate,
    userData,
    unidadeNome,
  } = novaEntrega;

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  const selectedDriver = useMemo(
    () =>
      motoristas.find((motorista) => motorista.id === motoristaSelecionado) ??
      null,
    [motoristaSelecionado, motoristas],
  );

  const setFormCoordinate = useCallback(
    (name: 'latitude' | 'longitude', value: number | undefined) => {
      form.setValue(name, value, { shouldValidate: true });
      const latitude = name === 'latitude' ? value : form.getValues('latitude');
      const longitude =
        name === 'longitude' ? value : form.getValues('longitude');
      setHasValidCoordinates(latitude != null && longitude != null);
    },
    [form],
  );

  const handleAddParada = useCallback(
    async (data: Parameters<typeof onAddParada>[0], linkId?: string) => {
      const duplicate = findDuplicate(data);
      let allowDuplicate = false;
      if (duplicate) {
        allowDuplicate = await showConfirm({
          title: 'Possível parada duplicada',
          message: `Já existe uma parada para ${duplicate.destinatario} no mesmo endereço ou telefone. Deseja manter as duas?`,
          type: 'warning',
          confirmText: 'Adicionar mesmo assim',
        });
        if (!allowDuplicate) return;
      }

      const saved = await onAddParada(data, linkId, allowDuplicate);
      if (saved) setHasValidCoordinates(false);
    },
    [findDuplicate, onAddParada, showConfirm],
  );

  const handleEdit = useCallback(
    (index: number) => {
      startEditParada(index);
      setHasValidCoordinates(true);
    },
    [startEditParada],
  );

  const handleCancelEdit = useCallback(() => {
    cancelEditParada();
    setHasValidCoordinates(false);
  }, [cancelEditParada]);

  const handleRemove = useCallback(
    async (index: number) => {
      const stop = paradas[index];
      if (!stop) return;
      const linkedCount = paradas.filter(
        (parada) => parada.vinculo_parada_id === stop.id,
      ).length;

      if (linkedCount > 0) {
        const confirmed = await showConfirm({
          title: 'Remover retirada vinculada?',
          message: `${linkedCount} entrega(s) dependem desta retirada. Ao remover, os vínculos serão desfeitos. Você ainda poderá usar “Desfazer”.`,
          type: 'warning',
          confirmText: 'Remover e desvincular',
        });
        if (!confirmed) return;
      }

      removeParada(index);
      if (editingParada?.id === stop.id) handleCancelEdit();
    },
    [editingParada?.id, handleCancelEdit, paradas, removeParada, showConfirm],
  );

  const handleClear = useCallback(async () => {
    const confirmed = await showConfirm({
      title: 'Descartar todo o rascunho?',
      message:
        'Todas as paradas, o motorista e a data serão removidos. Você poderá desfazer por alguns segundos.',
      type: 'warning',
      confirmText: 'Limpar rascunho',
    });
    if (confirmed) {
      limparFormulario();
      setHasValidCoordinates(false);
    }
  }, [limparFormulario, showConfirm]);

  const openReview = useCallback(() => {
    if (!canGenerateRoute) {
      showToast(
        routeValidation.erros[0] || 'Revise os dados da rota.',
        'error',
        5000,
      );
      return;
    }
    setReviewVisible(true);
  }, [canGenerateRoute, routeValidation.erros, showToast]);

  const confirmRoute = useCallback(async () => {
    const success = await gerarRota();
    if (success) setReviewVisible(false);
  }, [gerarRota]);

  const pageSubtitle = unidadeNome || pageMeta.subtitle || 'Carregando...';
  const draftStatus = draftSaveError
    ? draftSaveError
    : isDraftSaving
      ? 'Salvando rascunho...'
      : draftLastSavedAt
        ? 'Rascunho salvo automaticamente'
        : paradas.length > 0
          ? 'Rascunho aguardando sincronização'
          : '';

  if (isLoadingMotoristas || isLoadingEndereco || isDraftHydrating) {
    return (
      <>
        <MobileLoading
          message={
            isDraftHydrating
              ? 'Restaurando seu rascunho...'
              : 'Carregando dados...'
          }
        />
        {logoutModal}
      </>
    );
  }

  const listProps = {
    paradas,
    paradasStatus,
    motoristas,
    motoristaSelecionado,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    enderecoUnidade,
    isOptimizing,
    isCalculandoReal,
    isLoading,
    isDesktop,
    dataRota,
    canGenerateRoute,
    validationErrors: routeValidation.erros,
    onMoveUp: moveParadaUp,
    onMoveDown: moveParadaDown,
    onRemove: handleRemove,
    onEdit: handleEdit,
    onReorder: reorderParadas,
    onImport: importParadas,
    onOptimize: otimizarRota,
    onSelectMotorista: setMotoristaSelecionado,
    onChangeDataRota: setDataRota,
    onGenerateRoute: openReview,
  };

  const formProps = {
    control: form.control,
    errors: form.formState.errors,
    setValue: setFormCoordinate,
    handleSubmit: form.handleSubmit,
    watch: form.watch,
    onAddParada: handleAddParada,
    isLoading,
    retiradasDisponiveis,
    vinculoSelecionado,
    setVinculoSelecionado,
    locationBias: enderecoUnidade ?? undefined,
    hasValidCoordinates,
    isEditing: editingParada != null,
    onCancelEdit: handleCancelEdit,
  };

  const overlays = (
    <>
      <Toast {...toastState} onDismiss={hideToast} />
      <RouteReviewModal
        visible={reviewVisible}
        paradas={paradas}
        motorista={selectedDriver}
        unidadeNome={unidadeNome}
        enderecoUnidade={enderecoUnidade}
        dataRota={dataRota}
        rotaOtimizada={rotaOtimizada}
        ordemManual={ordemManual}
        distanciaManualReal={distanciaManualReal}
        validation={routeValidation}
        isLoading={isLoading}
        onClose={() => setReviewVisible(false)}
        onConfirm={confirmRoute}
      />
      {AlertDialog}
      {logoutModal}
    </>
  );

  if (isDesktop) {
    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={
            draftStatus ? `${pageSubtitle} · ${draftStatus}` : pageSubtitle
          }
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoadingMotoristas}
          loadingText="Carregando dados..."
        >
          <View style={styles.twoColumnLayout}>
            <View style={styles.formColumn}>
              <DesktopCard
                title={editingParada ? 'Editar Parada' : 'Adicionar Parada'}
                icon={editingParada ? 'create-outline' : 'add-circle-outline'}
                iconColor={theme.colors.primary}
                variant="outlined"
              >
                <FormularioParada {...formProps} />
              </DesktopCard>
            </View>
            <View style={styles.previewColumn}>
              <DesktopCard
                title="Paradas Adicionadas"
                subtitle={paradasStatus.texto}
                icon="list-outline"
                iconColor={
                  paradasStatus.cor === 'error'
                    ? theme.colors.error
                    : paradasStatus.cor === 'warning'
                      ? theme.colors.warning
                      : theme.colors.secondary
                }
                variant="elevated"
                actions={
                  <TouchableOpacity
                    style={[
                      styles.clearCardButton,
                      styles.clearCardButtonDesktop,
                      paradas.length === 0 && styles.clearCardButtonDisabled,
                    ]}
                    onPress={handleClear}
                    disabled={paradas.length === 0}
                    accessibilityLabel="Descartar rascunho e todas as paradas"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.clearCardButtonText,
                        styles.clearCardButtonTextDesktop,
                      ]}
                    >
                      Limpar rascunho
                    </Text>
                  </TouchableOpacity>
                }
              >
                <ParadasListAndActions {...listProps} />
              </DesktopCard>
            </View>
          </View>
        </DesktopPageLayout>
        {overlays}
      </ErrorBoundary>
    );
  }

  if (isTablet) {
    return (
      <ErrorBoundary>
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: Math.max(20, insets.bottom + 20),
          }}
        >
          <View style={styles.tabletContainer}>
            {draftStatus && (
              <Text
                style={styles.draftStatus}
                accessibilityLiveRegion="polite"
                accessibilityRole={draftSaveError ? 'alert' : undefined}
              >
                {draftStatus}
              </Text>
            )}
            <View style={styles.twoColumnLayout}>
              <View style={styles.formColumn}>
                <MobileCard
                  title={editingParada ? 'Editar Parada' : 'Adicionar Parada'}
                  variant="bordered"
                >
                  <FormularioParada {...formProps} />
                </MobileCard>
              </View>
              <View style={styles.previewColumn}>
                <MobileCard
                  title="Paradas Adicionadas"
                  subtitle={paradasStatus.texto}
                  variant="bordered"
                >
                  {paradas.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearCardButton}
                      onPress={handleClear}
                      accessibilityLabel="Descartar rascunho e todas as paradas"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={theme.colors.primary}
                      />
                      <Text style={styles.clearCardButtonText}>
                        Limpar rascunho
                      </Text>
                    </TouchableOpacity>
                  )}
                  <ParadasListAndActions {...listProps} />
                </MobileCard>
              </View>
            </View>
          </View>
        </ScrollView>
        {overlays}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: Math.max(120, insets.bottom + 110),
        }}
      >
        <View style={styles.content}>
          {draftStatus && (
            <Text
              style={styles.draftStatus}
              accessibilityLiveRegion="polite"
              accessibilityRole={draftSaveError ? 'alert' : undefined}
            >
              {draftStatus}
            </Text>
          )}
          <MobileCard
            title={editingParada ? 'Editar Parada' : 'Adicionar Parada'}
            variant="bordered"
          >
            <FormularioParada {...formProps} />
          </MobileCard>
          <MobileCard
            title="Paradas Adicionadas"
            subtitle={paradasStatus.texto}
            variant="bordered"
          >
            {paradas.length > 0 && (
              <TouchableOpacity
                style={styles.clearCardButton}
                onPress={handleClear}
                accessibilityLabel="Descartar rascunho e todas as paradas"
                accessibilityRole="button"
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.clearCardButtonText}>Limpar rascunho</Text>
              </TouchableOpacity>
            )}
            <ParadasListAndActions {...listProps} hideGenerateButton />
          </MobileCard>
        </View>
      </ScrollView>

      {paradas.length > 0 && (
        <View
          style={[
            styles.mobileActionBar,
            { paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <View style={styles.mobileActionSummary}>
            <Text style={styles.mobileActionCount}>
              {paradas.length} parada(s)
            </Text>
            <Text style={styles.mobileActionHint} numberOfLines={1}>
              {routeValidation.erros[0] || 'Pronta para revisão'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.mobileReviewButton,
              !canGenerateRoute && styles.mobileReviewButtonDisabled,
            ]}
            onPress={openReview}
            disabled={!canGenerateRoute}
            accessibilityRole="button"
            accessibilityLabel={
              isLoading
                ? 'Criando rota'
                : canGenerateRoute
                  ? `Revisar rota com ${paradas.length} paradas`
                  : routeValidation.erros[0] || 'Rota ainda não pode ser criada'
            }
            accessibilityState={{ disabled: !canGenerateRoute }}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={styles.mobileReviewButtonText}>Revisar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
      {overlays}
    </ErrorBoundary>
  );
}
