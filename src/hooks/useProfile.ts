import { User } from '@supabase/supabase-js';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect, useCallback } from 'react';
import { Alert, ActionSheetIOS, Platform } from 'react-native';

import { storageService } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  papel: 'gestor' | 'motorista';
  unidade_id: string | null;
  telefone: string | null;
  ativo: boolean;
  is_gestor_principal: boolean;
  primeira_senha: boolean;
  foto_url: string | null;
  ultimo_login: string | null;
}

type PhotoSource = 'camera' | 'gallery';

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  uploadingPhoto: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfilePhoto: (source?: PhotoSource) => Promise<void>;
  showPhotoOptions: () => void;
  isGestorPrincipal: boolean;
  refreshProfile: () => Promise<void>;
}

export function useProfile(user: User | null): UseProfileReturn {
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Carregar perfil
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
      setError(null);

      // Atualizar último login
      await supabase
        .from('usuarios')
        .update({ ultimo_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Atualizar perfil
  async function updateProfile(data: Partial<UserProfile>) {
    if (!userId || !profile) throw new Error('Usuário não autenticado');

    try {
      const { error: updateError } = await supabase
        .from('usuarios')
        .update(data)
        .eq('id', userId);

      if (updateError) throw updateError;

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao atualizar perfil');
    }
  }

  // Trocar senha
  async function changePassword(currentPassword: string, newPassword: string) {
    if (!userId || !userEmail) throw new Error('Usuário não autenticado');

    try {
      // Validar senha atual fazendo login novamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) throw new Error('Senha atual incorreta');

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Marcar como não sendo mais primeira senha
      await supabase
        .from('usuarios')
        .update({ primeira_senha: false })
        .eq('id', userId);

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao trocar senha');
    }
  }

  // Helper para alertas compatíveis com web
  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // Helper para confirmação compatível com web
  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: onConfirm },
      ]);
    }
  };

  // Atualizar foto de perfil
  async function updateProfilePhoto(source: PhotoSource = 'gallery') {
    if (!userId || !profile) {
      showAlert('Erro', 'Usuário não autenticado');
      return;
    }

    try {
      // Solicitar permissão apropriada (não necessário na web)
      if (Platform.OS !== 'web') {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            showAlert('Permissão necessária', 'Precisamos de permissão para acessar a câmera');
            return;
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            showAlert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos');
            return;
          }
        }
      }

      // Abrir câmera ou galeria
      const launchFn = source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await launchFn({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      // Função de upload
      const doUpload = async () => {
        setUploadingPhoto(true);
        try {
          const photoUri = result.assets[0].uri;

          // Upload da foto (deletando antiga se existir)
          const fotoUrl = await storageService.uploadFotoUsuario(
            userId,
            photoUri,
            profile.foto_url
          );

          if (fotoUrl) {
            // Atualizar estado local
            setProfile({ ...profile, foto_url: fotoUrl });
            showAlert('Sucesso', 'Foto de perfil atualizada!');
          } else {
            throw new Error('Falha no upload');
          }
        } catch (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          showAlert('Erro', 'Não foi possível atualizar a foto');
        } finally {
          setUploadingPhoto(false);
        }
      };

      // Confirmação antes do upload
      showConfirm(
        'Atualizar foto',
        'Deseja usar esta foto como sua foto de perfil?',
        doUpload
      );
    } catch (err) {
      console.error('Erro ao selecionar foto:', err);
      showAlert('Erro', 'Não foi possível selecionar a foto');
    }
  }

  // Mostrar opções de foto (câmera ou galeria)
  function showPhotoOptions() {
    if (Platform.OS === 'web') {
      // Web: Abre galeria diretamente (câmera não é confiável na web)
      updateProfilePhoto('gallery');
    } else if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tirar Foto', 'Escolher da Galeria'],
          cancelButtonIndex: 0,
          title: 'Alterar foto de perfil',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            updateProfilePhoto('camera');
          } else if (buttonIndex === 2) {
            updateProfilePhoto('gallery');
          }
        }
      );
    } else {
      // Android - usar Alert
      Alert.alert(
        'Alterar foto de perfil',
        'Como você deseja adicionar sua foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tirar Foto', onPress: () => updateProfilePhoto('camera') },
          { text: 'Escolher da Galeria', onPress: () => updateProfilePhoto('gallery') },
        ]
      );
    }
  }

  return {
    profile,
    loading,
    error,
    uploadingPhoto,
    updateProfile,
    changePassword,
    updateProfilePhoto,
    showPhotoOptions,
    isGestorPrincipal: profile?.is_gestor_principal || false,
    refreshProfile: loadProfile,
  };
}
