/**
 * Types for DrawerMenu component
 */

export interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export interface GestorData {
  nome: string;
  telefone: string | null;
  email: string | null;
}

export interface MenuItem {
  icon: string;
  label: string;
  path: string | null;
  show: boolean;
  action?: string;
  danger?: boolean;
}
