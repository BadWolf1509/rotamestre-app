/**
 * Hook de gerenciamento de perfil do usuário
 *
 * Modular architecture:
 * - profile/useProfileDialogs.ts: Cross-platform alert/confirm dialogs
 * - profile/useProfilePhoto.ts: Photo upload and picker
 * - profile/types.ts: Shared interfaces
 */

import { User } from "@supabase/supabase-js";
import { useState, useEffect, useCallback } from "react";

import { supabase } from "@/lib/supabase";

import { useProfileDialogs } from "./profile/useProfileDialogs";
import { useProfilePhoto } from "./profile/useProfilePhoto";

import type { UserProfile } from "./profile/types";

// Re-export types for backwards compatibility
export type {
  UserProfile,
  PhotoSource,
  ConfirmDialogState,
  AlertDialogState,
} from "./profile/types";

export function useProfile(user: User | null) {
  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extracted hooks
  const {
    confirmDialog,
    closeConfirmDialog,
    alertDialog,
    closeAlertDialog,
    showAlert,
    showConfirm,
  } = useProfileDialogs();

  const { uploadingPhoto, updateProfilePhoto, showPhotoOptions } =
    useProfilePhoto({
      userId,
      profile,
      setProfile,
      showAlert,
      showConfirm,
    });

  // Load profile
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;

      setProfile(data);
      setError(null);

      // Update last login
      await supabase
        .from("usuarios")
        .update({ ultimo_login: new Date().toISOString() })
        .eq("id", userId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Update profile fields
  async function updateProfile(data: Partial<UserProfile>) {
    if (!userId || !profile) throw new Error("Usuário não autenticado");

    try {
      const { error: updateError } = await supabase
        .from("usuarios")
        .update(data)
        .eq("id", userId);

      if (updateError) throw updateError;

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || "Erro ao atualizar perfil", {
        cause: err,
      });
    }
  }

  // Change password
  async function changePassword(currentPassword: string, newPassword: string) {
    if (!userId || !userEmail) throw new Error("Usuário não autenticado");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) throw new Error("Senha atual incorreta");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      await supabase
        .from("usuarios")
        .update({ primeira_senha: false })
        .eq("id", userId);

      await loadProfile();
    } catch (err: any) {
      throw new Error(err.message || "Erro ao trocar senha", { cause: err });
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
    confirmDialog,
    closeConfirmDialog,
    alertDialog,
    closeAlertDialog,
  };
}
