/**
 * Types for DrawerMenu component
 */
import type { Href } from 'expo-router';

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
  path: Href | null;
  show: boolean;
  action?: string;
  danger?: boolean;
}
