import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { UserMenuTrigger } from '@/components/UserMenuTrigger';
import type { UserMenuItem } from '@/design-system';

import { useLogoutConfirmation } from './useLogoutConfirmation';

interface UseDesktopHeaderMenuOptions {
  userName?: string | null;
  userImageUrl?: string | null;
  profileRoute?: string;
}

export function useDesktopHeaderMenu({
  userName,
  userImageUrl,
  profileRoute = '/perfil',
}: UseDesktopHeaderMenuOptions = {}) {
  const router = useRouter();
  const { showLogoutModal, logoutModal } = useLogoutConfirmation();

  const userMenuTrigger = useMemo(
    () => (isOpen: boolean) => (
      <UserMenuTrigger name={userName ?? undefined} imageUrl={userImageUrl} isOpen={isOpen} />
    ),
    [userName, userImageUrl]
  );

  const userMenuItems = useMemo<UserMenuItem[]>(
    () => [
      {
        label: 'Meu Perfil',
        icon: 'person-outline',
        onPress: () => router.push(profileRoute as never),
      },
      {
        label: 'Sair',
        icon: 'log-out-outline',
        destructive: true,
        onPress: showLogoutModal,
      },
    ],
    [profileRoute, router, showLogoutModal]
  );

  return {
    userMenuTrigger,
    userMenuItems,
    logoutModal,
    openLogoutModal: showLogoutModal,
  };
}
