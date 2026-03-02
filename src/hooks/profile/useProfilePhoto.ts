import * as ImagePicker from "expo-image-picker";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { clearCache, CACHE_KEYS } from "@/lib/cache";
import { logger } from "@/lib/logger";
import { emitProfileUpdate } from "@/lib/profileEvents";
import { storageService } from "@/lib/storage";

import type { PhotoSource, UserProfile } from "./types";

interface UseProfilePhotoOptions {
  userId: string | null;
  profile: UserProfile | null;
  setProfile: Dispatch<SetStateAction<UserProfile | null>>;
  showAlert: (
    title: string,
    message: string,
    type?: "default" | "error" | "success" | "warning",
  ) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

/**
 * Manages profile photo upload flow: permission checks, image picker,
 * upload to Supabase Storage, and cache invalidation.
 */
export function useProfilePhoto({
  userId,
  profile,
  setProfile,
  showAlert,
  showConfirm,
}: UseProfilePhotoOptions) {
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const updateProfilePhoto = useCallback(
    async (source: PhotoSource = "gallery") => {
      if (!userId || !profile) {
        showAlert("Erro", "Usuário não autenticado", "error");
        return;
      }

      try {
        // Request appropriate permission (not needed on web)
        if (Platform.OS !== "web") {
          if (source === "camera") {
            const { status } =
              await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              showAlert(
                "Permissão necessária",
                "Precisamos de permissão para acessar a câmera",
                "warning",
              );
              return;
            }
          } else {
            const { status } =
              await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
              showAlert(
                "Permissão necessária",
                "Precisamos de permissão para acessar suas fotos",
                "warning",
              );
              return;
            }
          }
        }

        const launchFn =
          source === "camera"
            ? ImagePicker.launchCameraAsync
            : ImagePicker.launchImageLibraryAsync;

        const result = await launchFn({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (result.canceled || !result.assets[0]) {
          return;
        }

        const doUpload = async () => {
          setUploadingPhoto(true);
          try {
            const photoUri = result.assets[0].uri;
            const fotoUrl = await storageService.uploadFotoUsuario(
              userId,
              photoUri,
              profile.foto_url,
            );

            if (fotoUrl) {
              setProfile({ ...profile, foto_url: fotoUrl });
              await clearCache(CACHE_KEYS.USER_DATA(userId));
              emitProfileUpdate();
              showAlert("Sucesso", "Foto de perfil atualizada!", "success");
            } else {
              throw new Error("Falha no upload");
            }
          } catch (uploadError) {
            logger.error("Erro ao fazer upload:", uploadError);
            showAlert("Erro", "Não foi possível atualizar a foto", "error");
          } finally {
            setUploadingPhoto(false);
          }
        };

        showConfirm(
          "Atualizar foto",
          "Deseja usar esta foto como sua foto de perfil?",
          doUpload,
        );
      } catch (err) {
        logger.error("Erro ao selecionar foto:", err);
        showAlert("Erro", "Não foi possível selecionar a foto", "error");
      }
    },
    [userId, profile, setProfile, showAlert, showConfirm],
  );

  const showPhotoOptions = useCallback(() => {
    if (Platform.OS === "web") {
      updateProfilePhoto("gallery");
    } else if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancelar", "Tirar Foto", "Escolher da Galeria"],
          cancelButtonIndex: 0,
          title: "Alterar foto de perfil",
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            updateProfilePhoto("camera");
          } else if (buttonIndex === 2) {
            updateProfilePhoto("gallery");
          }
        },
      );
    } else {
      Alert.alert(
        "Alterar foto de perfil",
        "Como você deseja adicionar sua foto?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Tirar Foto", onPress: () => updateProfilePhoto("camera") },
          {
            text: "Escolher da Galeria",
            onPress: () => updateProfilePhoto("gallery"),
          },
        ],
      );
    }
  }, [updateProfilePhoto]);

  return { uploadingPhoto, updateProfilePhoto, showPhotoOptions };
}
