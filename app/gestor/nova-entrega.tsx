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
import { DesktopCard } from '@/components/desktop/DesktopCard';
import { DesktopPageLayout } from '@/components/desktop/DesktopPageLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  ParadasListAndActions,
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
} from '@/components/gestor/nova-entrega';
import { Toast } from '@/components/Toast';
import { getGestorPageMeta } from '@/constants/gestorPageMeta';
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
  const styles = createStyles(theme, { isDesktop, isTablet, isMobile });
  const tipoAtual = watch('tipo');

  return (
    <View style={styles.form}>
      {/* Título só aparece em mobile/tablet - desktop usa header do DesktopCard */}
      {!isDesktop && (
        <Text style={styles.sectionTitle}>Adicionar Parada</Text>
      )}

      <Controller
        control={control}
        name="tipo"
        render={({ field: { onChange, value } }) => (
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={[
                styles.radioButton,
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
                  value === 'entrega' && styles.radioTextActive,
                ]}
              >
                Entrega
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.radioButton,
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
        <View style={styles.vinculoSection}>
          <Text style={styles.vinculoLabel}>
            Vincular a uma retirada? (equipamento locado)
          </Text>
          <Text style={styles.vinculoHint}>
            Se esta entrega usa equipamento que será retirado de outro cliente, selecione a retirada correspondente
          </Text>
          <View style={styles.vinculoOptions}>
            <TouchableOpacity
              style={[
                styles.vinculoOption,
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
                errors.destinatario && styles.inputError,
              ]}
              placeholder="Nome do destinatário"
              value={value}
              onChangeText={onChange}
              accessibilityLabel="Campo de nome do destinatário"
              accessibilityHint="Digite o nome completo do destinatário"
            />
            {errors.destinatario && (
              <Text style={styles.errorText}>{errors.destinatario.message}</Text>
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
              <Text style={styles.errorText}>{errors.telefone.message}</Text>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name="observacoes"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, styles.textArea]}
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
        style={styles.addButton}
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
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.addButtonText}>+ Adicionar Parada</Text>
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
  const { isDesktop, isTablet, isMobile } = useResponsive();
  const styles = createStyles(theme, { isDesktop, isTablet, isMobile });
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryDark} />
        </View>
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
                      size={18}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.clearCardButtonText}>Limpar formulário</Text>
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
          <ParadasListAndActions {...paradasListProps} />
        </View>
      </ScrollView>
      <Toast {...toastState} onDismiss={hideToast} />
      {logoutModal}
    </ErrorBoundary>
  );
}

// ============================================
// Estilos Responsivos (baseado em best practices 2025)
// @see Material Design 3, Apple HIG, WCAG 2.2
// ============================================

interface ResponsiveParams {
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
}

const createStyles = (theme: Theme, { isDesktop, isTablet: _isTablet, isMobile }: ResponsiveParams) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray50,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.gray50,
  },
  // Mobile: padding 16px (Material Design recomenda 16px para mobile)
  // Tablet/Desktop: handled separately
  content: {
    paddingHorizontal: isMobile ? theme.spacing.md : theme.spacing.lg, // 16px mobile, 24px tablet+
    paddingVertical: theme.spacing.lg, // 24px (era 40px)
    maxWidth: isMobile ? '100%' : 960, // Container max para tablet
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Tablet container com maxWidth de 960px
  tabletContainer: {
    paddingHorizontal: theme.spacing.lg, // 24px
    paddingVertical: theme.spacing.lg, // 24px
    maxWidth: 960,
    marginHorizontal: 'auto',
    width: '100%',
  },
  // Two column layout - Desktop: 40/60, Tablet: 40/60
  // Não definimos maxWidth aqui pois DesktopPageLayout já tem maxWidth: 1400
  twoColumnLayout: {
    flexDirection: 'row',
    gap: theme.spacing.lg, // 24px - Material Design recomenda 24px
    alignItems: 'flex-start',
    width: '100%',
  },
  // Form column: 38% (≈ 5/13 para compensar o gap)
  // Usamos width percentual para garantir proporção correta em React Native Web
  formColumn: {
    width: '38%',
    maxWidth: 500, // Limita em telas muito largas
  },
  // Preview column: 62% (≈ 8/13)
  previewColumn: {
    flex: 1, // Ocupa o resto do espaço disponível
    minWidth: 0, // Permite shrink
  },
  // Form card - padding responsivo
  // No desktop, o DesktopCard provê o container, então removemos border/background
  form: {
    backgroundColor: isDesktop ? 'transparent' : theme.colors.white,
    padding: isDesktop ? 0 : theme.spacing.lg, // Desktop: 0 (DesktopCard tem padding), Mobile/Tablet: 24px
    borderRadius: isDesktop ? 0 : theme.borderRadius.xl,
    marginBottom: isMobile ? theme.spacing.lg : 0,
    borderWidth: isDesktop ? 0 : 1,
    borderColor: isDesktop ? 'transparent' : theme.colors.gray200,
  },
  sectionTitle: {
    fontSize: theme.typography.lg,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.lg, // 24px (era 40px)
  },
  // Radio buttons - compacto no desktop, confortável no mobile
  radioGroup: {
    flexDirection: 'row',
    gap: isDesktop ? theme.desktop.section.gap : theme.spacing.md,
    marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
  },
  radioButton: {
    flex: 1,
    paddingVertical: isDesktop ? 6 : theme.spacing.md,
    paddingHorizontal: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    alignItems: 'center',
    minHeight: isDesktop ? theme.desktop.button.height : 48,
  },
  radioButtonActive: {
    backgroundColor: theme.colors.primaryDark,
    borderColor: theme.colors.primaryDark,
  },
  radioText: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray700,
  },
  radioTextActive: {
    color: theme.colors.white,
  },
  vinculoSection: {
    marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.lg,
    padding: isDesktop ? theme.desktop.section.padding : theme.spacing.md,
    backgroundColor: theme.colors.info + '08',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.info + '30',
  },
  vinculoLabel: {
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
    marginBottom: isDesktop ? 4 : theme.spacing.sm,
  },
  vinculoHint: {
    fontSize: isDesktop ? 12 : theme.typography.xs,
    color: theme.colors.gray500,
    marginBottom: isDesktop ? theme.desktop.section.gap : theme.spacing.md,
    lineHeight: isDesktop ? 14 : 16,
  },
  vinculoOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isDesktop ? 6 : theme.spacing.sm,
  },
  // Vínculo option - compacto no desktop
  vinculoOption: {
    paddingVertical: isDesktop ? 4 : theme.spacing.sm + 2,
    paddingHorizontal: isDesktop ? theme.desktop.section.padding : theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
    minWidth: isDesktop ? 80 : 100,
    minHeight: isDesktop ? 28 : 40,
    justifyContent: 'center',
  },
  vinculoOptionActive: {
    borderColor: theme.colors.info,
    backgroundColor: theme.colors.info + '15',
  },
  vinculoOptionText: {
    fontSize: isDesktop ? 12 : theme.typography.xs,
    color: theme.colors.gray700,
    textAlign: 'center',
  },
  vinculoOptionTextActive: {
    color: theme.colors.info,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  // Input - compacto no desktop, confortável no mobile
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray300,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: isDesktop ? theme.desktop.input.paddingHorizontal : theme.spacing.md,
    paddingVertical: isDesktop ? 0 : theme.spacing.md,
    fontSize: isDesktop ? theme.desktop.input.fontSize : theme.typography.base,
    marginBottom: isDesktop ? theme.desktop.field.marginBottom : theme.spacing.md,
    backgroundColor: theme.colors.white,
    minHeight: isDesktop ? theme.desktop.input.height : 48,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  textArea: {
    height: isDesktop ? 60 : 80,
    textAlignVertical: 'top',
    paddingVertical: isDesktop ? theme.spacing.xs : theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: isDesktop ? 12 : theme.typography.xs,
    marginTop: isDesktop ? -8 : -theme.spacing.sm,
    marginBottom: isDesktop ? 8 : theme.spacing.sm,
  },
  // Add button - compacto no desktop, não full-width
  addButton: {
    backgroundColor: theme.colors.secondary,
    paddingVertical: isDesktop ? 6 : theme.spacing.md,
    paddingHorizontal: isDesktop ? theme.spacing.xl : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    alignSelf: isDesktop ? 'flex-start' : 'stretch',
    marginTop: isDesktop ? theme.spacing.xs : theme.spacing.sm,
    minHeight: isDesktop ? theme.desktop.button.height : 48,
    justifyContent: 'center',
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.base,
    fontFamily: theme.typography.fontSansSemiBold,
  },
  clearCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isDesktop ? 4 : theme.spacing.xs,
    paddingHorizontal: isDesktop ? theme.desktop.button.paddingHorizontal : theme.spacing.md,
    paddingVertical: isDesktop ? 4 : theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    backgroundColor: theme.colors.white,
    minHeight: isDesktop ? 28 : 36,
  },
  clearCardButtonDisabled: {
    opacity: 0.5,
  },
  clearCardButtonText: {
    fontSize: isDesktop ? theme.desktop.button.fontSize : theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
});
