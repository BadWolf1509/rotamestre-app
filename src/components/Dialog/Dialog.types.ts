/**
 * Types and interfaces for Dialog component
 */
import type { IconName } from '@/types/icons';

export type DialogVariant = 'alert' | 'confirm' | 'destructive';
export type DialogType = 'default' | 'error' | 'success' | 'warning' | 'danger' | 'info';

export interface DialogProps {
  /** Visibilidade do dialog */
  visible: boolean;
  /** Título do dialog */
  title: string;
  /** Mensagem/descrição */
  message: string;
  /** Variante do dialog */
  variant?: DialogVariant;
  /** Tipo visual (cor do ícone/botão) */
  type?: DialogType;
  /** Texto do botão de confirmação */
  confirmText?: string;
  /** Texto do botão de cancelar (apenas variant="confirm"|"destructive") */
  cancelText?: string;
  /** Callback ao confirmar */
  onConfirm: () => void;
  /** Callback ao cancelar (apenas variant="confirm"|"destructive") */
  onCancel?: () => void;
  /** Estado de loading no botão de confirmação */
  loading?: boolean;
  /** Texto obrigatório para confirmar ações destrutivas (variant="destructive") */
  destructiveConfirmText?: string;
}

/** Mapeamento de type para ícone (confirm/destructive variants) */
export const ICON_MAP: Record<DialogType, IconName> = {
  default: 'information-circle-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
  error: 'alert-circle-outline',
  danger: 'trash-outline',
};

/** Mapeamento de type para ícone (alert variant) */
export const ALERT_ICON_MAP: Record<DialogType, IconName> = {
  default: 'information-circle-outline',
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  warning: 'warning-outline',
  error: 'close-circle-outline',
  danger: 'close-circle-outline',
};
