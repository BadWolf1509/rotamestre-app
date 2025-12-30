/**
 * IncidentReportWizard - Wizard de 4 passos para reportar incidentes
 * Usa DesktopModal para consistência em todas as plataformas
 *
 * Passos:
 * 1. Categoria - Seleção do tipo de problema
 * 2. Foto - Upload opcional de foto do incidente
 * 3. Descrição - Texto descritivo do problema
 * 4. Revisão - Confirmação antes de enviar
 *
 * Features:
 * - Upload de foto (câmera ou galeria)
 * - Geolocalização automática (se sem endereço)
 * - Validação por passo
 * - Feedback visual de progresso
 * - Confirmação ao fechar
 * - Memoizado para evitar re-renders
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useCallback, memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { ConfirmModal, DesktopModal, StepIndicator, type Step } from '@/design-system';
import { useIncidentSubmit } from '@/hooks/useIncidentSubmit';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

// Tipo para chaves de cores de incidente no tema
type IncidentColorKey = keyof Theme['colors']['incident'];

interface IncidentCategory {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: IncidentColorKey;
}

interface IncidentReportWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: IncidentReport) => void;
  paradaId?: string;
  rotaId?: string;
  motoristaId: string;
  endereco?: string;
}

export interface IncidentReport {
  category: string;
  description: string;
  photoUri?: string;
  paradaId?: string;
  rotaId?: string;
  motoristaId: string;
  endereco?: string;
  timestamp: string;
}

// Categorias de incidente usando tokens do tema
const INCIDENT_CATEGORIES: IncidentCategory[] = [
  { value: 'accident', label: 'Acidente/Incidente', icon: 'warning', colorKey: 'accident' },
  { value: 'absent', label: 'Cliente ausente', icon: 'home-outline', colorKey: 'absent' },
  { value: 'wrong_address', label: 'Endereço incorreto', icon: 'location-outline', colorKey: 'wrongAddress' },
  { value: 'blocked', label: 'Acesso bloqueado', icon: 'lock-closed-outline', colorKey: 'blocked' },
  { value: 'vehicle_issue', label: 'Problema no veículo', icon: 'car-outline', colorKey: 'vehicle' },
  { value: 'weather', label: 'Condições climáticas', icon: 'rainy-outline', colorKey: 'weather' },
  { value: 'other', label: 'Outro problema', icon: 'help-circle-outline', colorKey: 'other' },
];

// Helper para obter cor do tema baseado na chave
const getIncidentColor = (theme: Theme, colorKey: IncidentColorKey): string => {
  return theme.colors.incident[colorKey];
};

const STEPS: Step[] = [
  { id: 'category', title: 'Tipo de Problema' },
  { id: 'photo', title: 'Foto (Opcional)' },
  { id: 'description', title: 'Descrição' },
  { id: 'review', title: 'Revisar e Enviar' },
];

function IncidentReportWizardComponent({
  visible,
  onClose,
  onSubmit,
  paradaId,
  rotaId,
  motoristaId,
  endereco,
}: IncidentReportWizardProps) {
  const { theme } = useUnistyles();
  const { isDesktop } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();

  // Hook de submissão com retry automático
  const {
    submit: submitIncident,
    isSubmitting,
    uploadProgress,
    uploadRetryCount,
    reset: resetSubmit,
  } = useIncidentSubmit();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string>('');
  const [manualEndereco, setManualEndereco] = useState('');

  // Modal states
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Photo display states (for retry functionality)
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [hasPhotoError, setHasPhotoError] = useState(false);
  const [photoRetryCount, setPhotoRetryCount] = useState(0);

  // Calcular largura da imagem baseado na tela
  const imageWidth = isDesktop ? 400 : screenWidth - 80;

  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setSelectedCategory('');
    setDescription('');
    setPhotoUri('');
    setManualEndereco('');
    resetSubmit();
  }, [resetSubmit]);

  const handleClose = useCallback(() => {
    // Se já preencheu algo, pedir confirmação
    if (selectedCategory || description || photoUri) {
      setShowConfirmClose(true);
    } else {
      resetWizard();
      onClose();
    }
  }, [selectedCategory, description, photoUri, resetWizard, onClose]);

  const confirmClose = useCallback(() => {
    setShowConfirmClose(false);
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  const handleNext = useCallback(() => {
    if (currentStep === 0 && !selectedCategory) {
      setErrorMessage('Selecione o tipo de problema');
      setShowErrorModal(true);
      return;
    }
    if (currentStep === 2 && description.length < 20) {
      setErrorMessage('A descrição deve ter pelo menos 20 caracteres');
      setShowErrorModal(true);
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, selectedCategory, description]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da permissão da câmera para tirar fotos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da permissão para acessar suas fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, []);

  const removePhoto = useCallback(() => {
    setPhotoUri('');
    setIsPhotoLoading(false);
    setHasPhotoError(false);
    setPhotoRetryCount(0);
  }, []);

  // Photo display handlers (for preview with retry)
  const handlePhotoLoad = useCallback(() => {
    setIsPhotoLoading(false);
    setHasPhotoError(false);
  }, []);

  const handlePhotoError = useCallback(() => {
    setIsPhotoLoading(false);
    setHasPhotoError(true);
  }, []);

  const handlePhotoRetry = useCallback(() => {
    setPhotoRetryCount((prev) => prev + 1);
    setIsPhotoLoading(true);
    setHasPhotoError(false);
  }, []);

  // Gerar URI com cache-busting para retry
  const displayPhotoUri = photoRetryCount > 0 ? `${photoUri}?retry=${photoRetryCount}` : photoUri;

  const handleSubmit = useCallback(async () => {
    const result = await submitIncident({
      category: selectedCategory,
      description,
      photoUri: photoUri || undefined,
      paradaId,
      rotaId,
      motoristaId,
      endereco: endereco || manualEndereco || undefined,
    });

    if (result.success) {
      setShowSuccessModal(true);
    } else {
      setErrorMessage(result.error || 'Não foi possível enviar o reporte. Tente novamente.');
      setShowErrorModal(true);
    }
  }, [submitIncident, selectedCategory, description, photoUri, paradaId, rotaId, motoristaId, endereco, manualEndereco]);

  const handleSuccessConfirm = useCallback(() => {
    setShowSuccessModal(false);
    const report: IncidentReport = {
      category: selectedCategory,
      description,
      photoUri,
      paradaId,
      rotaId,
      motoristaId,
      endereco: endereco || manualEndereco || 'Localização não informada',
      timestamp: new Date().toISOString(),
    };
    resetWizard();
    onSubmit(report);
    onClose();
  }, [selectedCategory, description, photoUri, paradaId, rotaId, motoristaId, endereco, manualEndereco, resetWizard, onSubmit, onClose]);

  const handleCategorySelect = useCallback((value: string) => {
    setSelectedCategory(value);
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
  }, []);

  const handleManualEnderecoChange = useCallback((text: string) => {
    setManualEndereco(text);
  }, []);

  // Step 1: Category Selection
  const renderCategoryStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Qual o tipo de problema?
      </Text>
      <Text style={styles.stepSubtitle}>
        Selecione a categoria que melhor descreve a situação
      </Text>

      <View style={[styles.categoriesContainer, isDesktop && styles.categoriesContainerDesktop]}>
        {INCIDENT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.value}
            style={[
              styles.categoryCard,
              isDesktop && styles.categoryCardDesktop,
              selectedCategory === category.value && styles.categoryCardSelected,
            ]}
            onPress={() => handleCategorySelect(category.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selectedCategory === category.value }}
            accessibilityLabel={category.label}
          >
            <View style={[styles.categoryIcon, { backgroundColor: getIncidentColor(theme, category.colorKey) + '20' }]}>
              <Ionicons name={category.icon} size={24} color={getIncidentColor(theme, category.colorKey)} />
            </View>
            <Text
              style={[
                styles.categoryLabel,
                selectedCategory === category.value && styles.categoryLabelSelected,
              ]}
            >
              {category.label}
            </Text>
            {selectedCategory === category.value && (
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Step 2: Photo Upload
  const renderPhotoStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Adicionar foto do problema
      </Text>
      <Text style={styles.stepSubtitle}>
        Uma foto ajuda a documentar melhor o incidente
      </Text>

      {photoUri ? (
        <View style={styles.photoContainer}>
          {/* Loading indicator */}
          {isPhotoLoading && !hasPhotoError && (
            <View style={styles.photoLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.photoLoadingText}>Carregando foto...</Text>
            </View>
          )}

          {/* Error state with retry */}
          {hasPhotoError && (
            <View style={styles.photoErrorContainer}>
              <Ionicons name="image-outline" size={48} color={theme.colors.gray400} />
              <Text style={styles.photoErrorText}>Não foi possível carregar a foto</Text>
              <TouchableOpacity
                style={styles.photoRetryButton}
                onPress={handlePhotoRetry}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar a foto novamente"
              >
                <Ionicons name="refresh" size={16} color={theme.colors.primary} />
                <Text style={styles.photoRetryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Photo image */}
          {!hasPhotoError && (
            <Image
              source={{ uri: displayPhotoUri }}
              style={[
                styles.photo,
                { width: imageWidth, opacity: isPhotoLoading ? 0 : 1 },
              ]}
              resizeMode="cover"
              accessibilityLabel="Foto do incidente"
              onLoad={handlePhotoLoad}
              onError={handlePhotoError}
            />
          )}

          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={removePhoto}
            accessibilityRole="button"
            accessibilityLabel="Remover foto"
          >
            <Ionicons name="close-circle" size={28} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.photoOptions, isDesktop && styles.photoOptionsDesktop]}>
          <TouchableOpacity
            style={styles.photoOption}
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel="Tirar foto com a câmera"
          >
            <Ionicons name="camera" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Tirar Foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.photoOption}
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="Escolher foto da galeria"
          >
            <Ionicons name="images" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Escolher da Galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleNext}
        accessibilityRole="button"
        accessibilityLabel="Pular este passo"
      >
        <Text style={styles.skipButtonText}>Pular este passo</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 3: Description
  const renderDescriptionStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
        Descreva o problema
      </Text>
      <Text style={styles.stepSubtitle}>
        Forneça detalhes sobre o que aconteceu
      </Text>

      <TextInput
        style={[styles.descriptionInput, isDesktop && styles.descriptionInputDesktop]}
        multiline
        numberOfLines={isDesktop ? 4 : 6}
        placeholder="Ex: Cheguei ao local mas o portão estava fechado e não havia ninguém para receber. Tentei ligar mas ninguém atendeu..."
        placeholderTextColor={theme.colors.gray400}
        value={description}
        onChangeText={handleDescriptionChange}
        textAlignVertical="top"
        maxLength={500}
        accessibilityLabel="Descrição do problema"
        accessibilityHint="Digite pelo menos 20 caracteres"
      />

      <Text style={styles.charCount}>
        {description.length}/500 caracteres (mínimo 20)
      </Text>
    </View>
  );

  // Step 4: Review
  const renderReviewStep = () => {
    const category = INCIDENT_CATEGORIES.find((c) => c.value === selectedCategory);

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>
          Revisar informações
        </Text>

        {/* Barra de progresso durante upload */}
        {isSubmitting && (
          <View style={styles.uploadProgressContainer}>
            <View style={styles.uploadProgressBar}>
              <View
                style={[
                  styles.uploadProgressFill,
                  { width: `${uploadProgress}%` },
                ]}
              />
            </View>
            <Text style={styles.uploadProgressText}>
              {uploadRetryCount > 1
                ? `Tentativa ${uploadRetryCount}/3 - Enviando...`
                : `Enviando reporte... ${uploadProgress}%`}
            </Text>
          </View>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>LOCAL:</Text>
          {!endereco ? (
            <TextInput
              style={styles.manualAddressInput}
              placeholder="Informe o local do incidente..."
              placeholderTextColor={theme.colors.gray400}
              value={manualEndereco}
              onChangeText={handleManualEnderecoChange}
              accessibilityLabel="Local do incidente"
              editable={!isSubmitting}
            />
          ) : (
            <Text style={styles.reviewValue}>{endereco}</Text>
          )}
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>TIPO DE PROBLEMA:</Text>
          <View style={styles.reviewCategory}>
            <Ionicons
              name={category?.icon || 'help-circle-outline'}
              size={20}
              color={category ? getIncidentColor(theme, category.colorKey) : theme.colors.gray500}
            />
            <Text style={styles.reviewValue}>{category?.label}</Text>
          </View>
        </View>

        {photoUri && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>FOTO:</Text>
            <Image
              source={{ uri: photoUri }}
              style={styles.reviewPhoto}
              resizeMode="cover"
              accessibilityLabel="Foto do incidente anexada"
            />
          </View>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>DESCRIÇÃO:</Text>
          <Text style={styles.reviewDescription}>{description}</Text>
        </View>
      </View>
    );
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderCategoryStep();
      case 1:
        return renderPhotoStep();
      case 2:
        return renderDescriptionStep();
      case 3:
        return renderReviewStep();
      default:
        return null;
    }
  };

  // Determine if next button should be disabled
  const isNextDisabled =
    (currentStep === 0 && !selectedCategory) ||
    (currentStep === 2 && description.length < 20);

  // Determine button configuration
  const getPrimaryButton = () => {
    if (currentStep < STEPS.length - 1) {
      return {
        text: 'Próximo',
        onPress: handleNext,
        disabled: isNextDisabled,
      };
    }
    return {
      text: 'Enviar Reporte',
      onPress: handleSubmit,
      loading: isSubmitting,
      color: theme.colors.success,
    };
  };

  const getSecondaryButton = () => {
    if (currentStep > 0) {
      return {
        text: 'Voltar',
        onPress: handleBack,
        disabled: isSubmitting,
      };
    }
    return undefined;
  };

  return (
    <>
      <DesktopModal
        visible={visible}
        onClose={handleClose}
        title="Reportar Problema"
        maxWidth={600}
        primaryButton={getPrimaryButton()}
        secondaryButton={getSecondaryButton()}
      >
        <View style={styles.container} accessibilityLiveRegion="polite">
          <StepIndicator
              steps={STEPS}
              currentStep={currentStep}
              accessibilityLabel={`Passo ${currentStep + 1} de ${STEPS.length}: ${STEPS[currentStep]?.title}`}
            />

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderStepContent()}
          </ScrollView>
        </View>
      </DesktopModal>

      {/* Modal de confirmação para fechar */}
      <ConfirmModal
        visible={showConfirmClose}
        title="Cancelar Reporte"
        message="Tem certeza que deseja cancelar o reporte do incidente? As informações preenchidas serão perdidas."
        confirmText="Sim, cancelar"
        cancelText="Continuar editando"
        type="warning"
        onConfirm={confirmClose}
        onCancel={() => setShowConfirmClose(false)}
      />

      {/* Modal de sucesso */}
      <ConfirmModal
        visible={showSuccessModal}
        title="Incidente Reportado"
        message="O problema foi registrado e será analisado pela gestão."
        confirmText="OK"
        cancelText=""
        type="info"
        onConfirm={handleSuccessConfirm}
        onCancel={handleSuccessConfirm}
      />

      {/* Modal de erro */}
      <ConfirmModal
        visible={showErrorModal}
        title="Atenção"
        message={errorMessage}
        confirmText="OK"
        cancelText=""
        type="warning"
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />
    </>
  );
}

// Memoizar componente para evitar re-renders desnecessários
export const IncidentReportWizard = memo(IncidentReportWizardComponent);

const styles = StyleSheet.create((theme: Theme) => ({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },

  // Step Content
  stepContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  stepTitle: {
    fontSize: theme.typography.xl,
    fontFamily: theme.typography.fontSansBold,
    color: theme.colors.gray900,
    marginBottom: theme.spacing.xs,
  },
  stepTitleDesktop: {
    fontSize: theme.typography.lg,
  },
  stepSubtitle: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.lg,
  },

  // Category Step
  categoriesContainer: {
    gap: theme.spacing.sm,
  },
  categoriesContainerDesktop: {
    gap: theme.spacing.xs,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryCardDesktop: {
    padding: theme.spacing.sm,
  },
  categoryCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryBg,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  categoryLabel: {
    flex: 1,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  categoryLabelSelected: {
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray900,
  },

  // Photo Step
  photoContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    minHeight: 200,
    justifyContent: 'center',
  },
  photo: {
    height: 200,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray100,
  },
  photoLoadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  photoLoadingText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
  },
  photoErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  photoErrorText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textAlign: 'center',
  },
  photoRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryBg,
    marginTop: theme.spacing.sm,
  },
  photoRetryText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.primary,
  },
  removePhotoButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.overlay,
    borderRadius: 14,
  },
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  photoOptionsDesktop: {
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  photoOption: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    minWidth: 120,
  },
  photoOptionText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  skipButtonText: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    textDecorationLine: 'underline',
  },

  // Description Step
  descriptionInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    minHeight: 150,
    backgroundColor: theme.colors.gray50,
  },
  descriptionInputDesktop: {
    minHeight: 120,
  },
  charCount: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray500,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },

  // Review Step
  reviewSection: {
    marginBottom: theme.spacing.lg,
  },
  reviewLabel: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSansSemiBold,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: theme.typography.base,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray800,
  },
  reviewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  reviewPhoto: {
    width: 150,
    height: 100,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.gray100,
  },
  reviewDescription: {
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray700,
    lineHeight: 20,
    backgroundColor: theme.colors.gray50,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.xs,
  },
  manualAddressInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sm,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.gray900,
    backgroundColor: theme.colors.gray50,
    marginTop: theme.spacing.xs,
  },

  // Upload Progress
  uploadProgressContainer: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryBg,
    borderRadius: theme.borderRadius.md,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: theme.colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: theme.typography.xs,
    fontFamily: theme.typography.fontSans,
    color: theme.colors.primary,
    textAlign: 'center',
  },
}));
