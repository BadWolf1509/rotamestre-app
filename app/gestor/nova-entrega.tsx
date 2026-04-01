/**
 * Tela de Nova Entrega - Gestor
 *
 * Permite criar rotas de entrega com:
 * - Adição de paradas via autocomplete do Google Places
 * - Vinculação de entregas a retiradas (dependências)
 * - Otimização de rota via Google Directions API
 * - Atribuição a motorista
 * - Criação de rota circular (unidade → paradas → unidade)
 */

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  FormularioParada,
  ParadasListAndActions,
  novaEntregaStyles as styles,
} from "@/components/gestor/nova-entrega";
import { getGestorPageMeta } from "@/constants/gestorPageMeta";
import {
  DesktopCard,
  DesktopPageLayout,
  MobileCard,
  MobileLoading,
  Toast,
} from "@/design-system";
import { useDesktopHeaderMenu } from "@/hooks/useDesktopHeaderMenu";
import { useNovaEntrega } from "@/hooks/useNovaEntrega";
import { useResponsive } from "@/hooks/useResponsive";
import { useUnistyles } from "@/utils/styles";

export default function NovaEntrega() {
  const { theme } = useUnistyles();
  const { isDesktop, isTablet } = useResponsive();
  const insets = useSafeAreaInsets();
  const pageMeta = getGestorPageMeta("novaRota");

  const {
    form,
    paradas,
    motoristas,
    motoristaSelecionado,
    vinculoSelecionado,
    isLoading,
    isLoadingMotoristas,
    isOptimizing,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    isCalculandoReal,
    enderecoUnidade,
    retiradasDisponiveis,
    paradasStatus,
    toastState,
    showToast: _showToast,
    hideToast,
    setMotoristaSelecionado,
    setVinculoSelecionado,
    onAddParada,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    otimizarRota,
    gerarRota,
    limparFormulario,
    userData,
    unidadeNome,
  } = useNovaEntrega();

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
    userImageUrl: userData?.foto_url,
  });

  const pageSubtitle = unidadeNome || pageMeta.subtitle || "Carregando...";

  const [hasValidCoordinates, setHasValidCoordinates] = useState(false);

  const setFormCoordinate = useCallback(
    (name: "latitude" | "longitude", value: number) => {
      form.setValue(name, value);
      if (name === "longitude" && value !== 0) {
        setHasValidCoordinates(true);
      }
    },
    [form],
  );

  const handleAddParada = useCallback(
    (data: Parameters<typeof onAddParada>[0], vinculoId?: string) => {
      onAddParada(data, vinculoId);
      setHasValidCoordinates(false);
    },
    [onAddParada],
  );

  if (isLoadingMotoristas) {
    return (
      <>
        <MobileLoading message="Carregando dados..." />
        {logoutModal}
      </>
    );
  }

  const paradasListProps = {
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
    onMoveUp: moveParadaUp,
    onMoveDown: moveParadaDown,
    onRemove: removeParada,
    onOptimize: otimizarRota,
    onSelectMotorista: setMotoristaSelecionado,
    onGenerateRoute: gerarRota,
  };

  const formularioProps = {
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
  };

  // Desktop Layout
  if (isDesktop) {
    return (
      <ErrorBoundary>
        <DesktopPageLayout
          title={pageMeta.title}
          subtitle={pageSubtitle}
          breadcrumbs={pageMeta.breadcrumbs}
          userMenuTrigger={userMenuTrigger}
          userMenuItems={userMenuItems}
          loading={isLoadingMotoristas}
          loadingText="Carregando dados..."
        >
          <View style={styles.twoColumnLayout}>
            <View style={styles.formColumn}>
              <DesktopCard
                title="Adicionar Parada"
                icon="add-circle-outline"
                iconColor={theme.colors.primary}
                variant="outlined"
              >
                <FormularioParada {...formularioProps} />
              </DesktopCard>
            </View>

            <View style={styles.previewColumn}>
              <DesktopCard
                title="Paradas Adicionadas"
                subtitle={paradasStatus.texto}
                icon="list-outline"
                iconColor={
                  paradasStatus.cor === "error"
                    ? theme.colors.error
                    : paradasStatus.cor === "warning"
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
                    onPress={limparFormulario}
                    disabled={paradas.length === 0}
                    accessibilityLabel="Limpar formulário e todas as paradas"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: paradas.length === 0 }}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.clearCardButtonText,
                        styles.clearCardButtonTextDesktop,
                      ]}
                    >
                      Limpar formulário
                    </Text>
                  </TouchableOpacity>
                }
              >
                <ParadasListAndActions {...paradasListProps} />
              </DesktopCard>
            </View>
          </View>
        </DesktopPageLayout>

        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  // Tablet Layout - Split View (40/60)
  if (isTablet) {
    return (
      <ErrorBoundary>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingBottom: Math.max(20, insets.bottom + 20),
          }}
        >
          <View style={styles.tabletContainer}>
            <View style={styles.twoColumnLayout}>
              <View style={styles.formColumn}>
                <FormularioParada {...formularioProps} />
              </View>

              <View style={styles.previewColumn}>
                <ParadasListAndActions {...paradasListProps} />
              </View>
            </View>
          </View>
        </ScrollView>
        <Toast {...toastState} onDismiss={hideToast} />
        {logoutModal}
      </ErrorBoundary>
    );
  }

  // Mobile Layout - Single Column
  return (
    <ErrorBoundary>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: Math.max(20, insets.bottom + 20),
        }}
      >
        <View style={styles.content}>
          <MobileCard title="Adicionar Parada" variant="bordered">
            <FormularioParada {...formularioProps} />
          </MobileCard>
          <MobileCard
            title="Paradas Adicionadas"
            subtitle={paradasStatus.texto}
            variant="bordered"
          >
            <ParadasListAndActions {...paradasListProps} />
          </MobileCard>
        </View>
      </ScrollView>
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </ErrorBoundary>
  );
}
