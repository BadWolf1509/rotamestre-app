/**
 * DrawerMenu component
 * Main drawer navigation for the app
 *
 * Modular architecture:
 * - DrawerHeader: User profile display
 * - DrawerMenuItems: Navigation menu items
 * - DrawerFooter: Profile link, logout, version
 * - DrawerContactModal: Contact reason selection (web)
 * - hooks/useDrawerLogout: Logout logic
 * - hooks/useDrawerContact: Contact gestor logic
 */

import { useRouter, usePathname } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';

import { ConfirmDialog } from '@/design-system';
import { useUser } from '@/hooks/useUser';
import { StyleSheet, type Theme } from '@/utils/styles';

import { DrawerContactModal } from './DrawerContactModal';
import { DrawerFooter } from './DrawerFooter';
import { DrawerHeader } from './DrawerHeader';
import { DrawerMenuItems } from './DrawerMenuItems';
import { useDrawerContact } from './hooks/useDrawerContact';
import { useDrawerLogout } from './hooks/useDrawerLogout';

import type { DrawerMenuProps, MenuItem } from './types';

export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { userData: profile, unidade } = useUser();

  // Hooks for logout and contact logic
  const {
    showLogoutDialog,
    showErrorDialog,
    handleLogoutPress,
    handleLogoutConfirm,
    handleLogoutCancel,
    handleErrorDismiss,
  } = useDrawerLogout({ onClose });

  const {
    showContactModal,
    gestorDataForModal,
    handleContactGestor,
    handleWebReasonSelect,
    handleCloseContactModal,
  } = useDrawerContact({ onClose });

  // Navigation helper
  const navigate = useCallback(
    (path: string) => {
      onClose();
      router.push(path);
    },
    [onClose, router]
  );

  // Menu action handler
  const handleAction = useCallback(
    (action: string) => {
      if (action === 'contactGestor') {
        handleContactGestor();
      }
    },
    [handleContactGestor]
  );

  // Menu items configuration
  const gestorMenuItems: MenuItem[] = useMemo(
    () => [
      { icon: '🏠', label: 'Início', path: '/gestor/inicio', show: true },
      { icon: '📦', label: 'Nova Rota', path: '/gestor/nova-entrega', show: true },
      { icon: '📋', label: 'Gestão de Rotas', path: '/gestor/gestao-rotas', show: true },
      { icon: '⚠️', label: 'Incidentes', path: '/gestor/incidentes', show: true },
      { icon: '🧑‍✈️', label: 'Motoristas', path: '/gestor/motoristas', show: true },
      { icon: '🏢', label: 'Minha Unidade', path: '/unidade', show: profile?.papel === 'gestor' },
      { icon: '👥', label: 'Equipe', path: '/unidade/equipe', show: profile?.papel === 'gestor' },
    ],
    [profile?.papel]
  );

  const motoristaMenuItems: MenuItem[] = useMemo(
    () => [
      { icon: '👤', label: 'Meu Perfil', path: '/motorista/perfil', show: true },
      { icon: '📊', label: 'Meu Desempenho', path: '/motorista/desempenho', show: true },
      {
        icon: '📞',
        label: 'Falar com Gestor',
        path: null,
        action: 'contactGestor',
        show: true,
      },
      { icon: '🆘', label: 'SOS / Emergência', path: '/motorista/sos', show: true, danger: true },
      { icon: '❓', label: 'Ajuda', path: '/motorista/ajuda', show: true },
      { icon: '⚙️', label: 'Configurações', path: '/motorista/perfil/configuracoes', show: true },
    ],
    []
  );

  const isMotorista = profile?.papel === 'motorista';
  const menuItems = isMotorista ? motoristaMenuItems : gestorMenuItems;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.drawer}
          onPress={(e) => e.stopPropagation()}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.content}>
              <DrawerHeader profile={profile} unidade={unidade ?? null} />

              <DrawerMenuItems
                items={menuItems}
                currentPath={pathname}
                onNavigate={navigate}
                onAction={handleAction}
              />

              <DrawerFooter
                isMotorista={isMotorista}
                onNavigateProfile={() => navigate('/perfil')}
                onLogout={handleLogoutPress}
              />
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Logout Dialog */}
      <ConfirmDialog
        visible={showLogoutDialog}
        title="Sair da conta"
        message="Deseja realmente encerrar sua sessão?"
        confirmText="Sair"
        cancelText="Cancelar"
        type="destructive"
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

      {/* Error Dialog */}
      <ConfirmDialog
        visible={showErrorDialog}
        title="Erro ao sair"
        message="Não foi possível encerrar sua sessão. Tente novamente."
        confirmText="Entendi"
        cancelText="Fechar"
        type="destructive"
        onConfirm={handleErrorDismiss}
        onCancel={handleErrorDismiss}
      />

      {/* Contact Modal (Web) */}
      <DrawerContactModal
        visible={showContactModal}
        gestorData={gestorDataForModal}
        onSelectReason={handleWebReasonSelect}
        onClose={handleCloseContactModal}
      />
    </Modal>
  );
}

const styles = StyleSheet.create((theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-start',
  },
  drawer: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
}));
