/**
 * Hook de perfil das telas de Perfil (gestor e motorista) e da primeira senha.
 *
 * O registro vem do `useUser` (busca compartilhada, guarda de troca de conta e
 * de resposta velha); aqui ficam só a foto e os diálogos (R-NUC-3). Antes este
 * hook fazia a própria consulta de `usuarios` sem guarda (a resposta da conta
 * anterior sobrescrevia a atual, B-NUC-3) e regravava `ultimo_login` a cada
 * abertura — o "Último acesso" do Perfil mostrava a última vez que a pessoa
 * abriu o Perfil (B-NUC-2). O login já grava esse campo (`src/lib/auth.ts`).
 *
 * Alternativa considerada: manter a consulta, só tirando a escrita e pondo
 * contador de requisição. Corrigia os dois sintomas, mas deixava uma segunda
 * fonte do mesmo registro na tela. A API morta (`updateProfile`,
 * `changePassword`, `refreshProfile`, `isGestorPrincipal`, `error`) saiu junto:
 * nenhuma tela a usava.
 *
 * Modular architecture:
 * - profile/useProfileDialogs.ts: Cross-platform alert/confirm dialogs
 * - profile/useProfilePhoto.ts: Photo upload and picker
 * - profile/types.ts: Shared interfaces
 */

import { User } from '@supabase/supabase-js';
import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { useProfileDialogs } from './profile/useProfileDialogs';
import { useProfilePhoto } from './profile/useProfilePhoto';
import { useUser } from './useUser';

import type { UserProfile } from './profile/types';
import type { Usuario } from '../types/usuario';

// Re-export types for backwards compatibility
export type { UserProfile } from './profile/types';

/** `Usuario` (campos opcionais) → `UserProfile` (com os valores neutros). */
function paraPerfil(u: Usuario): UserProfile {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    unidade_id: u.unidade_id ?? null,
    telefone: u.telefone ?? null,
    ativo: u.ativo ?? true,
    is_gestor_principal: u.is_gestor_principal ?? false,
    primeira_senha: u.primeira_senha ?? false,
    foto_url: u.foto_url ?? null,
    ultimo_login: u.ultimo_login ?? null,
  };
}

export function useProfile(user: User | null) {
  const userId = user?.id ?? null;
  const { userData, loading } = useUser();

  // Só o perfil de quem está na tela: na troca de conta sem fechar o app, o
  // useUser pode ainda ter o da conta anterior.
  const doUseUser = useMemo(
    () => (userId && userData?.id === userId ? paraPerfil(userData) : null),
    [userId, userData],
  );

  // A foto nova aparece na hora (useProfilePhoto grava por `setProfile`),
  // até o useUser recarregar pelo `emitProfileUpdate`. Vale só para o
  // registro do useUser em que foi feita: o recarregado a substitui.
  const [otimista, setOtimista] = useState<{
    base: UserProfile;
    perfil: UserProfile | null;
  } | null>(null);
  const profile =
    otimista && doUseUser && otimista.base === doUseUser
      ? otimista.perfil
      : doUseUser;
  const setProfile: Dispatch<SetStateAction<UserProfile | null>> = useCallback(
    (proximo) => {
      if (!doUseUser) return;
      const perfil = typeof proximo === 'function' ? proximo(profile) : proximo;
      setOtimista({ base: doUseUser, perfil });
    },
    [doUseUser, profile],
  );

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

  return {
    profile,
    loading,
    uploadingPhoto,
    updateProfilePhoto,
    showPhotoOptions,
    confirmDialog,
    closeConfirmDialog,
    alertDialog,
    closeAlertDialog,
  };
}
