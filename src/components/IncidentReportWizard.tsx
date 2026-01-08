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

import * as ImagePicker from 'expo-image-picker';
import React, { useState, useCallback, memo } from 'react';
import {
  Alert,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

import { ConfirmModal, DesktopModal, StepIndicator, type Step } from '@/design-system';
import { useIncidentSubmit } from '@/hooks/useIncidentSubmit';
import { useResponsive } from '@/hooks/useResponsive';
import { StyleSheet, useUnistyles, type Theme } from '@/utils/styles';

import {
  CategoryStep,
  PhotoStep,
  DescriptionStep,
  ReviewStep,
  type IncidentReport,
} from './incident-wizard';

export type { IncidentReport };

interface IncidentReportWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: IncidentReport) => void;
  paradaId?: string;
  rotaId?: string;
  motoristaId: string;
  endereco?: string;
}

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

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <CategoryStep
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            isDesktop={isDesktop}
          />
        );
      case 1:
        return (
          <PhotoStep
            photoUri={photoUri}
            isPhotoLoading={isPhotoLoading}
            hasPhotoError={hasPhotoError}
            onTakePhoto={takePhoto}
            onPickImage={pickImage}
            onRemovePhoto={removePhoto}
            onPhotoLoad={handlePhotoLoad}
            onPhotoError={handlePhotoError}
            onPhotoRetry={handlePhotoRetry}
            onSkip={handleNext}
            displayPhotoUri={displayPhotoUri}
            imageWidth={imageWidth}
            isDesktop={isDesktop}
          />
        );
      case 2:
        return (
          <DescriptionStep
            description={description}
            onDescriptionChange={handleDescriptionChange}
            isDesktop={isDesktop}
          />
        );
      case 3:
        return (
          <ReviewStep
            selectedCategory={selectedCategory}
            description={description}
            photoUri={photoUri}
            endereco={endereco}
            manualEndereco={manualEndereco}
            onManualEnderecoChange={handleManualEnderecoChange}
            isSubmitting={isSubmitting}
            uploadProgress={uploadProgress}
            uploadRetryCount={uploadRetryCount}
            isDesktop={isDesktop}
          />
        );
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

const styles = StyleSheet.create((_theme: Theme) => ({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
}));
