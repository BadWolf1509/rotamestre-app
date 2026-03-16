/**
 * Tests for useProfilePhoto
 * Manages profile photo upload flow: permissions, image picker, upload, cache.
 */

import { renderHook, act } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { useProfilePhoto } from "../useProfilePhoto";

import type { UserProfile } from "../types";

// Mock dependencies
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/lib/storage", () => ({
  storageService: {
    uploadFotoUsuario: jest.fn(),
  },
}));

jest.mock("@/lib/cache", () => ({
  clearCache: jest.fn().mockResolvedValue(undefined),
  CACHE_KEYS: {
    USER_DATA: (userId: string) => `user_${userId}`,
  },
}));

jest.mock("@/lib/profileEvents", () => ({
  emitProfileUpdate: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockProfile: UserProfile = {
  id: "user-123",
  nome: "Test User",
  email: "test@example.com",
  papel: "gestor",
  unidade_id: "unit-123",
  telefone: null,
  ativo: true,
  is_gestor_principal: false,
  primeira_senha: false,
  foto_url: "https://old-photo.com/photo.jpg",
  ultimo_login: null,
};

const mockImageResult = {
  canceled: false,
  assets: [{ uri: "file:///photo.jpg", width: 100, height: 100 }],
};

const canceledResult = {
  canceled: true,
  assets: [],
};

describe("useProfilePhoto", () => {
  const showAlert = jest.fn();
  const showConfirm = jest.fn();
  const setProfile = jest.fn();

  const defaultProps = {
    userId: "user-123",
    profile: mockProfile,
    setProfile,
    showAlert,
    showConfirm,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: permissions granted
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (
      ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
    ).mockResolvedValue({
      status: "granted",
    });
    // Default: image picked successfully
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(
      mockImageResult,
    );
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue(
      mockImageResult,
    );
    // Default platform: android (non-web, non-ios)
    Platform.OS = "android";
  });

  describe("Return values", () => {
    it("should return uploadingPhoto as false initially", () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      expect(result.current.uploadingPhoto).toBe(false);
    });

    it("should return updateProfilePhoto function", () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      expect(typeof result.current.updateProfilePhoto).toBe("function");
    });

    it("should return showPhotoOptions function", () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      expect(typeof result.current.showPhotoOptions).toBe("function");
    });
  });

  describe("Guard: no user", () => {
    it("should show error alert when userId is null", async () => {
      const { result } = renderHook(() =>
        useProfilePhoto({ ...defaultProps, userId: null }),
      );

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Erro",
        "Usuário não autenticado",
        "error",
      );
    });

    it("should show error alert when profile is null", async () => {
      const { result } = renderHook(() =>
        useProfilePhoto({ ...defaultProps, profile: null }),
      );

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Erro",
        "Usuário não autenticado",
        "error",
      );
    });
  });

  describe("Permissions (non-web)", () => {
    it("should request camera permission for camera source", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("camera");
      });

      expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
      expect(
        ImagePicker.requestMediaLibraryPermissionsAsync,
      ).not.toHaveBeenCalled();
    });

    it("should request media library permission for gallery source", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(
        ImagePicker.requestMediaLibraryPermissionsAsync,
      ).toHaveBeenCalled();
      expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    });

    it("should show warning when camera permission denied", async () => {
      (
        ImagePicker.requestCameraPermissionsAsync as jest.Mock
      ).mockResolvedValue({
        status: "denied",
      });

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("camera");
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Permissão necessária",
        "Precisamos de permissão para acessar a câmera",
        "warning",
      );
      // Should not launch picker
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });

    it("should show warning when media library permission denied", async () => {
      (
        ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock
      ).mockResolvedValue({
        status: "denied",
      });

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Permissão necessária",
        "Precisamos de permissão para acessar suas fotos",
        "warning",
      );
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it("should skip permission request on web", async () => {
      Platform.OS = "web";

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(
        ImagePicker.requestMediaLibraryPermissionsAsync,
      ).not.toHaveBeenCalled();
      expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
      // Should still launch picker
      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });

  describe("Image picking", () => {
    it("should launch gallery picker for gallery source", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    });

    it("should launch camera for camera source", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("camera");
      });

      expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    });

    it("should do nothing when picker is canceled", async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue(
        canceledResult,
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      // Should not show confirm dialog
      expect(showConfirm).not.toHaveBeenCalled();
    });

    it("should default to gallery source when no source specified", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto();
      });

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    });
  });

  describe("Confirmation and upload", () => {
    it("should show confirm dialog after picking image", async () => {
      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      expect(showConfirm).toHaveBeenCalledWith(
        "Atualizar foto",
        "Deseja usar esta foto como sua foto de perfil?",
        expect.any(Function),
      );
    });

    it("should upload photo when confirm callback is invoked", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockResolvedValue(
        "https://new-photo.com/photo.jpg",
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      // Extract the confirm callback
      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(storageService.uploadFotoUsuario).toHaveBeenCalledWith(
        "user-123",
        "file:///photo.jpg",
        "https://old-photo.com/photo.jpg",
      );
    });

    it("should update profile with new photo URL on success", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockResolvedValue(
        "https://new-photo.com/photo.jpg",
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          foto_url: "https://new-photo.com/photo.jpg",
        }),
      );
    });

    it("should clear cache and emit profile update on success", async () => {
      const { storageService } = require("@/lib/storage");
      const { clearCache } = require("@/lib/cache");
      const { emitProfileUpdate } = require("@/lib/profileEvents");
      storageService.uploadFotoUsuario.mockResolvedValue(
        "https://new-photo.com/photo.jpg",
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(clearCache).toHaveBeenCalledWith("user_user-123");
      expect(emitProfileUpdate).toHaveBeenCalled();
    });

    it("should show success alert after upload", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockResolvedValue(
        "https://new-photo.com/photo.jpg",
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Sucesso",
        "Foto de perfil atualizada!",
        "success",
      );
    });
  });

  describe("Upload error states", () => {
    it("should show error alert when upload returns null", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockResolvedValue(null);

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(showAlert).toHaveBeenCalledWith(
        "Erro",
        "Não foi possível atualizar a foto",
        "error",
      );
    });

    it("should show error alert when upload throws", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockRejectedValue(
        new Error("Upload failed"),
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      const { logger } = require("@/lib/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "Erro ao fazer upload:",
        expect.any(Error),
      );
      expect(showAlert).toHaveBeenCalledWith(
        "Erro",
        "Não foi possível atualizar a foto",
        "error",
      );
    });

    it("should log error when image picker throws", async () => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockRejectedValue(
        new Error("Picker crash"),
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const { logger } = require("@/lib/logger");
      expect(logger.error).toHaveBeenCalledWith(
        "Erro ao selecionar foto:",
        expect.any(Error),
      );
      expect(showAlert).toHaveBeenCalledWith(
        "Erro",
        "Não foi possível selecionar a foto",
        "error",
      );
    });
  });

  describe("Loading state", () => {
    it("should set uploadingPhoto to true during upload and false after", async () => {
      const { storageService } = require("@/lib/storage");

      let resolveUpload: (value: string) => void;
      storageService.uploadFotoUsuario.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpload = resolve;
          }),
      );

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      // Start upload (don't await yet)
      let uploadPromise: Promise<void>;
      act(() => {
        uploadPromise = confirmCallback();
      });

      // uploadingPhoto should be true while uploading
      expect(result.current.uploadingPhoto).toBe(true);

      // Resolve upload
      await act(async () => {
        resolveUpload!("https://new-photo.com/photo.jpg");
        await uploadPromise!;
      });

      expect(result.current.uploadingPhoto).toBe(false);
    });

    it("should reset uploadingPhoto to false even on error", async () => {
      const { storageService } = require("@/lib/storage");
      storageService.uploadFotoUsuario.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        await result.current.updateProfilePhoto("gallery");
      });

      const confirmCallback = showConfirm.mock.calls[0][2];

      await act(async () => {
        await confirmCallback();
      });

      expect(result.current.uploadingPhoto).toBe(false);
    });
  });

  describe("showPhotoOptions", () => {
    it("should call updateProfilePhoto with gallery on web", async () => {
      Platform.OS = "web";

      const { result } = renderHook(() => useProfilePhoto(defaultProps));

      await act(async () => {
        result.current.showPhotoOptions();
        // Allow the async updateProfilePhoto call to settle
        await Promise.resolve();
      });

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
    });
  });
});
