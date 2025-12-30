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

import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Controller, Control, FieldErrors, UseFormWatch, UseFormHandleSubmit } from 'react-hook-form';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';

import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  ParadasListAndActions,
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
} from '@/components/gestor/nova-entrega';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
import {
  DesktopCard,
  DesktopPageLayout,
  MobileCard,
  MobileLoading,
  Toast,
} from '@/design-system';
import { useDesktopHeaderMenu } from '@/hooks/useDesktopHeaderMenu';
import { useNovaEntrega } from '@/hooks/useNovaEntrega';
import { useResponsive } from '@/hooks/useResponsive';
import { googleMapsService } from '@/lib/google';
import { maskPhone } from '@/utils/phoneValidation';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// ============================================
// Formulário de Parada Memoizado
// ============================================

interface FormularioParadaProps {
  control: Control<ParadaFormDataWithCoords>;
  errors: FieldErrors<ParadaFormDataWithCoords>;
  setValue: (name: 'latitude' | 'longitude', value: number) => void;
  handleSubmit: UseFormHandleSubmit<ParadaFormDataWithCoords>;
  watch: UseFormWatch<ParadaFormDataWithCoords>;
  onAddParada: (data: ParadaFormData, vinculoId?: string) => void;
  isLoading: boolean;
  retiradasDisponiveis: Parada[];
  vinculoSelecionado: string;
  setVinculoSelecionado: (id: string) => void;
}

const FormularioParadaMemoized = memo(function FormularioParada({
  control,
  errors,
  setValue,
  handleSubmit,
  watch,
  onAddParada,
  isLoading,
  retiradasDisponiveis,
  vinculoSelecionado,
  setVinculoSelecionado,
}: FormularioParadaProps) {
  const { theme } = useUnistyles();
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const tipoAtual = watch('tipo');

  return (
    <View style={[
      styles.form,
      isDesktop && styles.formDesktop,
      isTablet && styles.formTablet,
      isMobile && styles.formMobileInner,
    ]}>
      {/* Título só aparece em tablet - desktop usa header do DesktopCard, mobile usa MobileCard */}
      {isTablet && (
        <Text style={styles.sectionTitle}>Adicionar Parada</Text>
      )}

      <Controller
        control={control}
        name="tipo"
        render={({ field: { onChange, value } }) => (
          <View style={[styles.radioGroup, isDesktop && styles.radioGroupDesktop]}>
            <TouchableOpacity
              style={[
                styles.radioButton,
                isDesktop && styles.radioButtonDesktop,
                value === 'entrega' && styles.radioButtonActive,
              ]}
              onPress={() => onChange('entrega')}
              accessibilityLabel="Selecionar tipo entrega"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === 'entrega' }}
            >
              <Text
                style={[
                  styles.radioText,
                  isDesktop && styles.radioTextDesktop,
                  value === 'entrega' && styles.radioTextActive,
                ]}
              >
                Entrega
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioButton,
                isDesktop && styles.radioButtonDesktop,
                value === 'retirada' && styles.radioButtonActive,
              ]}
              onPress={() => {
                onChange('retirada');
                setVinculoSelecionado('');
              }}
              accessibilityLabel="Selecionar tipo retirada"
              accessibilityRole="radio"
              accessibilityState={{ checked: value === 'retirada' }}
            >
              <Text
                style={[
                  styles.radioText,
                  isDesktop && styles.radioTextDesktop,
                  value === 'retirada' && styles.radioTextActive,
                ]}
              >
                Retirada
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Seletor de Vínculo */}
      {tipoAtual === 'entrega' && retiradasDisponiveis.length > 0 && (
        <View style={[styles.vinculoSection, isDesktop && styles.vinculoSectionDesktop]}>
          <Text style={[styles.vinculoLabel, isDesktop && styles.vinculoLabelDesktop]}>
            Vincular a uma retirada? (equipamento locado)
          </Text>
          <Text style={[styles.vinculoHint, isDesktop && styles.vinculoHintDesktop]}>
            Se esta entrega usa equipamento que será retirado de outro cliente, selecione a retirada correspondente
          </Text>
          <View style={[styles.vinculoOptions, isDesktop && styles.vinculoOptionsDesktop]}>
            <TouchableOpacity
              style={[
                styles.vinculoOption,
                isDesktop && styles.vinculoOptionDesktop,
                !vinculoSelecionado && styles.vinculoOptionActive,
              ]}
              onPress={() => setVinculoSelecionado('')}
              accessibilityLabel="Sem vínculo a retirada"
              accessibilityRole="radio"
              accessibilityState={{ checked: !vinculoSelecionado }}
            >
              <Text
                style={[
                  styles.vinculoOptionText,
                  isDesktop && styles.vinculoOptionTextDesktop,
                  !vinculoSelecionado && styles.vinculoOptionTextActive,
                ]}
              >
                Sem vínculo
              </Text>
            </TouchableOpacity>
            {retiradasDisponiveis.map((retirada) => {
              const isSelected = vinculoSelecionado === retirada.id;
              const retiradaNome = retirada.destinatario || retirada.endereco.substring(0, 30);
              return (
                <TouchableOpacity
                  key={retirada.id}
                  style={[
                    styles.vinculoOption,
                    isDesktop && styles.vinculoOptionDesktop,
                    isSelected && styles.vinculoOptionActive,
                  ]}
                  onPress={() => setVinculoSelecionado(retirada.id)}
                  accessibilityLabel={`Vincular a retirada: ${retiradaNome}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Text
                    style={[
                      styles.vinculoOptionText,
                      isDesktop && styles.vinculoOptionTextDesktop,
                      isSelected && styles.vinculoOptionTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {retiradaNome}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Controller
        control={control}
        name="endereco"
        render={({ field: { onChange, value } }) => (
          <AddressAutocomplete
            value={value || ''}
            onChangeText={onChange}
            onSelectAddress={async (address, placeId) => {
              onChange(address);
              const details = await googleMapsService.getPlaceDetails(placeId);
              if (details) {
                setValue('latitude', details.coordenadas.latitude);
                setValue('longitude', details.coordenadas.longitude);
              }
            }}
            placeholder="Digite o endereço completo"
            error={errors.endereco?.message}
            multiline
          />
        )}
      />

      <Controller
        control={control}
        name="destinatario"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                isDesktop && styles.inputDesktop,
                errors.destinatario && styles.inputError,
              ]}
              placeholder="Nome do destinatário"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Campo de nome do destinatário"
              accessibilityHint="Digite o nome completo do destinatário"
            />
            {errors.destinatario && (
              <Text style={[styles.errorText, isDesktop && styles.errorTextDesktop]}>
                {errors.destinatario.message}
              </Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="telefone"
        render={({ field: { onChange, value } }) => (
          <>
            <TextInput
              style={[
                styles.input,
                isDesktop && styles.inputDesktop,
                errors.telefone && styles.inputError,
              ]}
              placeholder="Telefone de contato"
              value={value}
              onChangeText={(text) => onChange(maskPhone(text))}
              keyboardType="phone-pad"
              maxLength={15}
              accessibilityLabel="Campo de telefone do destinatário"
              accessibilityHint="Digite o telefone do destinatário com DDD"
            />
            {errors.telefone && (
              <Text style={[styles.errorText, isDesktop && styles.errorTextDesktop]}>
                {errors.telefone.message}
              </Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="observacoes"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[
              styles.input,
              isDesktop && styles.inputDesktop,
              styles.textArea,
              isDesktop && styles.textAreaDesktop,
            ]}
            placeholder="Observações"
            value={value}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
            accessibilityLabel="Campo de observações"
            accessibilityHint="Digite observações adicionais sobre a entrega"
          />
        )}
      />

      <TouchableOpacity
        style={[styles.addButton, isDesktop && styles.addButtonDesktop]}
        onPress={handleSubmit((data: ParadaFormData) => {
          onAddParada(data, vinculoSelecionado || undefined);
          setVinculoSelecionado('');
        })}
        disabled={isLoading}
        accessibilityLabel="Adicionar parada à lista"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={[styles.addButtonText, isDesktop && styles.addButtonTextDesktop]}>
            + Adicionar Parada
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

// ============================================
// Componente Principal
// ============================================

export default function NovaEntrega() {
  const { theme } = useUnistyles();
  const { isDesktop, isTablet } = useResponsive();
  const pageMeta = getGestorPageMeta('novaRota');

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
    distanciaManualAproximada,
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
    calcularDistanciaReal,
    gerarRota,
    limparFormulario,
    userData,
    unidadeNome,
  } = useNovaEntrega();

  const { userMenuTrigger, userMenuItems, logoutModal } = useDesktopHeaderMenu({
    userName: userData?.nome,
  });

  const pageSubtitle = unidadeNome || pageMeta.subtitle || 'Carregando...';

  // Função para setar coordenadas no form (memoizada para evitar recriação)
  const setFormCoordinate = useCallback((name: 'latitude' | 'longitude', value: number) => {
    form.setValue(name, value);
  }, [form]);

  if (isLoadingMotoristas) {
    return (
      <>
        <MobileLoading message="Carregando dados..." />
        {logoutModal}
      </>
    );
  }

  // Props para o componente de lista de paradas
  const paradasListProps = {
    paradas,
    paradasStatus,
    motoristas,
    motoristaSelecionado,
    rotaOtimizada,
    ordemManual,
    distanciaManualReal,
    distanciaManualAproximada,
    enderecoUnidade,
    isOptimizing,
    isCalculandoReal,
    isLoading,
    isDesktop,
    onMoveUp: moveParadaUp,
    onMoveDown: moveParadaDown,
    onRemove: removeParada,
    onOptimize: otimizarRota,
    onCalculateReal: calcularDistanciaReal,
    onSelectMotorista: setMotoristaSelecionado,
    onGenerateRoute: gerarRota,
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
            {/* Formulário */}
            <View style={styles.formColumn}>
              <DesktopCard
                title="Adicionar Parada"
                icon="add-circle-outline"
                iconColor={theme.colors.primary}
                variant="outlined"
              >
                <FormularioParadaMemoized
                  control={form.control}
                  errors={form.formState.errors}
                  setValue={setFormCoordinate}
                  handleSubmit={form.handleSubmit}
                  watch={form.watch}
                  onAddParada={onAddParada}
                  isLoading={isLoading}
                  retiradasDisponiveis={retiradasDisponiveis}
                  vinculoSelecionado={vinculoSelecionado}
                  setVinculoSelecionado={setVinculoSelecionado}
                />
              </DesktopCard>
            </View>

            {/* Lista de Paradas e Ações */}
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
                    <Text style={[styles.clearCardButtonText, styles.clearCardButtonTextDesktop]}>
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
        <ScrollView style={styles.scrollView}>
          <View style={styles.tabletContainer}>
            <View style={styles.twoColumnLayout}>
              {/* Formulário - 40% */}
              <View style={styles.formColumn}>
                <FormularioParadaMemoized
                  control={form.control}
                  errors={form.formState.errors}
                  setValue={setFormCoordinate}
                  handleSubmit={form.handleSubmit}
                  watch={form.watch}
                  onAddParada={onAddParada}
                  isLoading={isLoading}
                  retiradasDisponiveis={retiradasDisponiveis}
                  vinculoSelecionado={vinculoSelecionado}
                  setVinculoSelecionado={setVinculoSelecionado}
                />
              </View>

              {/* Lista de Paradas - 60% */}
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
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <MobileCard title="Adicionar Parada" variant="bordered">
            <FormularioParadaMemoized
                control={form.control}
                errors={form.formState.errors}
                setValue={setFormCoordinate}
                handleSubmit={form.handleSubmit}
                watch={form.watch}
                onAddParada={onAddParada}
                isLoading={isLoading}
                retiradasDisponiveis={retiradasDisponiveis}
                vinculoSelecionado={vinculoSelecionado}
                setVinculoSelecionado={setVinculoSelecionado}
              />
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

// ============================================
// STYLES (estático - baseado em best practices 2025)
// @see Material Design 3, Apple HIG, WCAG 2.2
// ============================================

const styles = StyleSheet.create((theme: Theme) => ({
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  // Scroll
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  // Content - Mobile (16px padding)
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    maxWidth: '100%',
    marginHorizontal: 'auto',
    width: '100%',
  },
  contentTablet: {
    paddingHorizontal: theme.spacing.lg,
    maxWidth: 960,
  },
  // Tablet container
  tabletContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    maxWidth: 960,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two column layout
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    alignItems: 'flex-start',
    width: '100%',
  },
  formColumn: {
    width: '38%',
    maxWidth: 500,
  },
  previewColumn: {
    flex: 1,
    minWidth: 0,
  },
  // Form - Mobile/Tablet (usado dentro de MobileCard)
  form: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  formDesktop: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  formTablet: {
    marginBottom: 0,
  },
  // formMobile: padding interno quando dentro de MobileCard com noPadding
  formMobile: {
    padding: theme.spacing.md,
  },
  // formMobileInner: remove estilos de card quando dentro de MobileCard
  formMobileInner: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg,
  },
  // Radio buttons - Mobile
  radioGroup: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  radioGroupDesktop: {
    gap: theme.desktop.section.gap,
    marginBottom: theme.desktop.field.marginBottom,
  },
  radioButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  radioButtonDesktop: {
    paddingVertical: 6,
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    minHeight: theme.desktop.button.height,
  },
  radioButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  radioText: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  radioTextDesktop: {
    fontSize: theme.desktop.input.fontSize,
  },
  radioTextActive: {
    color: theme.colors.white,
  },
  // Vínculo section
  vinculoSection: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.info + '08',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  vinculoSectionDesktop: {
    marginBottom: theme.desktop.field.marginBottom,
    padding: theme.desktop.section.padding,
  },
  vinculoLabel: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.sm,
  },
  vinculoLabelDesktop: {
    fontSize: theme.desktop.input.fontSize,
    marginBottom: 4,
  },
  vinculoHint: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
    lineHeight: 16,
  },
  vinculoHintDesktop: {
    fontSize: 12,
    marginBottom: theme.desktop.section.gap,
    lineHeight: 14,
  },
  vinculoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  vinculoOptionsDesktop: {
    gap: 6,
  },
  vinculoOption: {
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    minWidth: 100,
    minHeight: 40,
    justifyContent: 'center',
  },
  vinculoOptionDesktop: {
    paddingVertical: 4,
    paddingHorizontal: theme.desktop.section.padding,
    minWidth: 80,
    minHeight: 28,
  },
  vinculoOptionActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.info + '15',
  },
  vinculoOptionText: {
    fontSize: theme.typography.xs,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  vinculoOptionTextDesktop: {
    fontSize: 12,
  },
  vinculoOptionTextActive: {
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  // Input - Mobile
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.base,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.white,
    minHeight: 48,
    color: theme.colors.gray900,
  },
  inputDesktop: {
    paddingHorizontal: theme.desktop.input.paddingHorizontal,
    paddingVertical: 0,
    fontSize: theme.desktop.input.fontSize,
    marginBottom: theme.desktop.field.marginBottom,
    minHeight: theme.desktop.input.height,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingVertical: theme.spacing.sm,
  },
  textAreaDesktop: {
    height: 60,
    paddingVertical: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  errorTextDesktop: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  // Add button - Mobile (full width)
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: theme.spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  addButtonDesktop: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.xl,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    minHeight: theme.desktop.button.height,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  addButtonTextDesktop: {
    fontSize: theme.desktop.button.fontSize,
  },
  // Clear button
  clearCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    minHeight: 36,
  },
  clearCardButtonDesktop: {
    gap: 4,
    paddingHorizontal: theme.desktop.button.paddingHorizontal,
    paddingVertical: 4,
    minHeight: 28,
  },
  clearCardButtonDisabled: {
    opacity: 0.5,
  },
  clearCardButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  clearCardButtonTextDesktop: {
    fontSize: theme.desktop.button.fontSize,
  },
}));
