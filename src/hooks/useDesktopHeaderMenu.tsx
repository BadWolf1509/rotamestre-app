import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { UserMenuItem } from '@/components/desktop/DesktopPageLayout';
import { UserMenuTrigger } from '@/components/UserMenuTrigger';

import { useLogoutConfirmation } from './useLogoutConfirmation';

interface UseDesktopHeaderMenuOptions {
  userName?: string | null;
  profileRoute?: string;
}

export function useDesktopHeaderMenu({
  userName,
  profileRoute = '/perfil',
}: UseDesktopHeaderMenuOptions = {}) {
  const router = useRouter();
  const { showLogoutModal, logoutModal } = useLogoutConfirmation();

  const userMenuTrigger = useMemo(
    () => (isOpen: boolean) => <UserMenuTrigger name={userName ?? undefined} isOpen={isOpen} />,
    [userName]
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
