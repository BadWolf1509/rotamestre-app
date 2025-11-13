import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { storageService } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { useUnistyles } from '@/utils/styles';

const { width: screenWidth } = Dimensions.get('window');

interface IncidentCategory {
  value: string;
  label: string;
  icon: string;
  color: string;
}

interface IncidentReportWizardProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (report: IncidentReport) => void;
  paradaId?: string;
  rotaId: string;
  motoristaId: string;
  endereco: string;
}

export interface IncidentReport {
  category: string;
  description: string;
  photoUri?: string;
  paradaId?: string;
  rotaId: string;
  motoristaId: string;
  endereco: string;
  timestamp: string;
}

const INCIDENT_CATEGORIES: IncidentCategory[] = [
  { value: 'accident', label: 'Acidente/Incidente', icon: 'warning', color: '#ef4444' },
  { value: 'absent', label: 'Cliente ausente', icon: 'home-outline', color: '#f59e0b' },
  { value: 'wrong_address', label: 'Endereço incorreto', icon: 'location-outline', color: '#3b82f6' },
  { value: 'blocked', label: 'Acesso bloqueado', icon: 'lock-closed-outline', color: '#8b5cf6' },
  { value: 'vehicle_issue', label: 'Problema no veículo', icon: 'car-outline', color: '#ec4899' },
  { value: 'weather', label: 'Condições climáticas', icon: 'rainy-outline', color: '#06b6d4' },
  { value: 'other', label: 'Outro problema', icon: 'help-circle-outline', color: '#6b7280' },
];

export function IncidentReportWizard({
  visible,
  onClose,
  onSubmit,
  paradaId,
  rotaId,
  motoristaId,
  endereco,
}: IncidentReportWizardProps) {
  const { theme } = useUnistyles();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const steps = [
    { id: 'category', title: 'Tipo de Problema' },
    { id: 'photo', title: 'Foto (Opcional)' },
    { id: 'description', title: 'Descrição' },
    { id: 'review', title: 'Revisar e Enviar' },
  ];

  const resetWizard = () => {
    setCurrentStep(0);
    setSelectedCategory('');
    setDescription('');
    setPhotoUri('');
  };

  const handleClose = () => {
    Alert.alert(
      'Cancelar Reporte',
      'Tem certeza que deseja cancelar o reporte do incidente?',
      [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Cancelar Reporte',
          style: 'destructive',
          onPress: () => {
            resetWizard();
            onClose();
          }
        },
      ]
    );
  };

  const handleNext = () => {
    if (currentStep === 0 && !selectedCategory) {
      Alert.alert('Atenção', 'Selecione o tipo de problema');
      return;
    }
    if (currentStep === 2 && description.length < 20) {
      Alert.alert('Atenção', 'A descrição deve ter pelo menos 20 caracteres');
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const takePhoto = async () => {
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
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos da permissão para acessar suas fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      let uploadedPhotoUrl = '';

      // Upload da foto se existir
      if (photoUri) {
        const fileName = `incident_${Date.now()}.jpg`;
        uploadedPhotoUrl = await storageService.uploadIncidentPhoto(photoUri, fileName);
      }

      // Criar registro no banco
      const { error } = await supabase.from('incidentes').insert({
        rota_id: rotaId,
        parada_id: paradaId,
        motorista_id: motoristaId,
        categoria: selectedCategory,
        descricao: description,
        foto_url: uploadedPhotoUrl,
        endereco: endereco,
        status: 'aberto',
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Criar log
      await supabase.from('logs').insert({
        usuario_id: motoristaId,
        rota_id: rotaId,
        parada_id: paradaId,
        evento: 'incidente_reportado',
        detalhes: {
          categoria: selectedCategory,
          descricao: description,
          tem_foto: !!photoUri,
        },
      });

      const report: IncidentReport = {
        category: selectedCategory,
        description,
        photoUri: uploadedPhotoUrl,
        paradaId,
        rotaId,
        motoristaId,
        endereco,
        timestamp: new Date().toISOString(),
      };

      Alert.alert(
        'Incidente Reportado',
        'O problema foi registrado e será analisado pela gestão.',
        [{ text: 'OK', onPress: () => {
          resetWizard();
          onSubmit(report);
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Erro ao reportar incidente:', error);
      Alert.alert('Erro', 'Não foi possível enviar o reporte. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              index <= currentStep && styles.stepCircleActive,
            ]}
          >
            {index < currentStep ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={[
                styles.stepNumber,
                index <= currentStep && styles.stepNumberActive
              ]}>
                {index + 1}
              </Text>
            )}
          </View>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                index < currentStep && styles.stepLineActive,
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderCategoryStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Qual o tipo de problema?</Text>
      <Text style={styles.stepSubtitle}>Selecione a categoria que melhor descreve a situação</Text>

      <ScrollView style={styles.categoriesContainer}>
        {INCIDENT_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.value}
            style={[
              styles.categoryCard,
              selectedCategory === category.value && styles.categoryCardSelected,
            ]}
            onPress={() => setSelectedCategory(category.value)}
          >
            <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
              <Ionicons name={category.icon as any} size={24} color={category.color} />
            </View>
            <Text style={[
              styles.categoryLabel,
              selectedCategory === category.value && styles.categoryLabelSelected
            ]}>
              {category.label}
            </Text>
            {selectedCategory === category.value && (
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Adicionar foto do problema</Text>
      <Text style={styles.stepSubtitle}>Uma foto ajuda a documentar melhor o incidente</Text>

      {photoUri ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
          <TouchableOpacity
            style={styles.removePhotoButton}
            onPress={() => setPhotoUri('')}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.photoOptions}>
          <TouchableOpacity style={styles.photoOption} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Tirar Foto</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.photoOption} onPress={pickImage}>
            <Ionicons name="images" size={32} color={theme.colors.primary} />
            <Text style={styles.photoOptionText}>Escolher da Galeria</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
        <Text style={styles.skipButtonText}>Pular este passo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDescriptionStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Descreva o problema</Text>
      <Text style={styles.stepSubtitle}>Forneça detalhes sobre o que aconteceu</Text>

      <TextInput
        style={styles.descriptionInput}
        multiline
        numberOfLines={6}
        placeholder="Ex: Cheguei ao local mas o portão estava fechado e não havia ninguém para receber. Tentei ligar mas ninguém atendeu..."
        value={description}
        onChangeText={setDescription}
        textAlignVertical="top"
      />

      <Text style={styles.charCount}>
        {description.length}/500 caracteres (mínimo 20)
      </Text>
    </View>
  );

  const renderReviewStep = () => {
    const category = INCIDENT_CATEGORIES.find(c => c.value === selectedCategory);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Revisar informações</Text>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Local:</Text>
          <Text style={styles.reviewValue}>{endereco}</Text>
        </View>

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Tipo de problema:</Text>
          <View style={styles.reviewCategory}>
            <Ionicons name={category?.icon as any} size={20} color={category?.color} />
            <Text style={styles.reviewValue}>{category?.label}</Text>
          </View>
        </View>

        {photoUri && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewLabel}>Foto:</Text>
            <Image source={{ uri: photoUri }} style={styles.reviewPhoto} />
          </View>
        )}

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Descrição:</Text>
          <Text style={styles.reviewDescription}>{description}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Reportar Problema</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Step Indicator */}
          {renderStepIndicator()}

          {/* Step Content */}
          <ScrollView style={styles.content}>
            {currentStep === 0 && renderCategoryStep()}
            {currentStep === 1 && renderPhotoStep()}
            {currentStep === 2 && renderDescriptionStep()}
            {currentStep === 3 && renderReviewStep()}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            {currentStep > 0 && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
              >
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>
            )}

            {currentStep < steps.length - 1 ? (
              <TouchableOpacity
                style={[styles.nextButton, !selectedCategory && currentStep === 0 && styles.buttonDisabled]}
                onPress={handleNext}
                disabled={!selectedCategory && currentStep === 0}
              >
                <Text style={styles.nextButtonText}>Próximo</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar Reporte</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create(theme => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stepIndicator: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 10,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: theme.colors.primary,
  },
  stepNumber: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 5,
  },
  stepLineActive: {
    backgroundColor: theme.colors.primary,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  categoriesContainer: {
    maxHeight: 300,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
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
    marginRight: 12,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  categoryLabelSelected: {
    fontWeight: '600',
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  photo: {
    width: screenWidth - 40,
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  photoOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 40,
  },
  photoOption: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    minWidth: 120,
  },
  photoOptionText: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
  },
  skipButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 150,
    backgroundColor: '#f9f9f9',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 16,
    color: '#333',
  },
  reviewCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewPhoto: {
    width: 150,
    height: 100,
    borderRadius: 8,
    marginTop: 8,
  },
  reviewDescription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
  },
  nextButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 12,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
