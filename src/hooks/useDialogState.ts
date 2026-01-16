/**
 * useDialogState - Hook para gerenciar estado de dialogs HTML5
 *
 * Extrai lógica comum de AlertDialog, ConfirmDialog para reutilização:
 * - Scroll lock (previne scroll do body enquanto dialog aberto)
 * - Dialog showModal/close
 * - ESC key e click no backdrop
 *
 * @example
 * ```tsx
 * const dialogRef = useRef<HTMLDialogElement>(null);
 * useDialogState(visible, dialogRef);
 * useDialogBackdropHandler(dialogRef, onClose);
 * ```
 */
import { useEffect, useRef, RefObject } from 'react';
import { Platform } from 'react-native';

/**
 * Gerencia estado do dialog HTML5: scroll lock, showModal/close
 *
 * - Salva posição de scroll ao abrir
 * - Trava body scroll enquanto aberto
 * - Restaura scroll ao fechar
 * - Cleanup automático
 */
export function useDialogState(
  visible: boolean,
  dialogRef: RefObject<HTMLDialogElement | null>
): void {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    if (visible) {
      // Save scroll position and lock body
      scrollPositionRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPositionRef.current}px`;
      document.body.style.width = '100%';

      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollPositionRef.current);
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [visible, dialogRef]);
}

/**
 * Gerencia eventos de backdrop do dialog HTML5: ESC key e click outside
 *
 * - Intercepta evento 'cancel' (ESC key) e chama onClose
 * - Detecta click no backdrop (click no próprio dialog, não no conteúdo)
 * - closeOnBackdrop=true por padrão (pode desabilitar para modais obrigatórios)
 */
export function useDialogBackdropHandler(
  dialogRef: RefObject<HTMLDialogElement | null>,
  onClose: () => void,
  closeOnBackdrop: boolean = true
): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !dialogRef.current) return;

    const dialog = dialogRef.current;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleBackdropClick = (e: MouseEvent) => {
      if (closeOnBackdrop && e.target === dialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleBackdropClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [dialogRef, onClose, closeOnBackdrop]);
}

/**
 * Hook combinado para uso simplificado
 * Combina useDialogState e useDialogBackdropHandler
 */
export function useWebDialog(
  visible: boolean,
  dialogRef: RefObject<HTMLDialogElement | null>,
  onClose: () => void,
  options?: { closeOnBackdrop?: boolean }
): void {
  useDialogState(visible, dialogRef);
  useDialogBackdropHandler(dialogRef, onClose, options?.closeOnBackdrop ?? true);
}
