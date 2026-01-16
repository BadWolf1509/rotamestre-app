/**
 * dialog-styles.ts - Estilos CSS globais unificados para dialogs
 *
 * Centraliza a injeção de estilos de backdrop e animação para todos os dialogs HTML5.
 * Substitui as 3 injeções duplicadas em AlertDialog, ConfirmDialog e Modal.
 *
 * Estilos incluídos:
 * - Backdrop com overlay escuro e blur
 * - Animação de fade-in ao abrir
 * - Animação de spinner para loading
 */
import { Platform } from 'react-native';

import { defaultTheme } from '@/utils/styles.base';

const STYLE_ID = 'dialog-unified-styles';

/**
 * Injeta estilos CSS globais para dialogs HTML5
 * Só executa uma vez (idempotente)
 */
export function injectDialogStyles(): void {
  // Skip on non-web platforms
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Skip if already injected
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Backdrop styles for all dialog classes */
    dialog.unified-dialog::backdrop,
    dialog.alert-dialog::backdrop,
    dialog.confirm-dialog::backdrop,
    dialog.modal-dialog::backdrop {
      background-color: ${defaultTheme.colors.overlay};
      backdrop-filter: blur(2px);
    }

    /* Open animation for all dialog classes */
    dialog.unified-dialog[open],
    dialog.alert-dialog[open],
    dialog.confirm-dialog[open],
    dialog.modal-dialog[open] {
      animation: dialog-fade-in 0.15s ease-out;
    }

    @keyframes dialog-fade-in {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    /* Spinner animation for loading states */
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Remove estilos injetados (útil para cleanup em testes)
 */
export function removeDialogStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
}
