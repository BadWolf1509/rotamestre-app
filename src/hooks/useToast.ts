import { useState, useCallback } from 'react';

import type { ToastType } from '@/design-system';

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Hook para gerenciar Toasts de feedback visual
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toast, showToast, hideToast } = useToast();
 *
 *   const handleSave = async () => {
 *     showToast('Salvando...', 'loading');
 *     await saveData();
 *     showToast('Salvo com sucesso!', 'success');
 *   };
 *
 *   return (
 *     <>
 *       <Button onPress={handleSave} />
 *       <Toast {...toast} onDismiss={hideToast} />
 *     </>
 *   );
 * }
 * ```
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'success',
    duration: 3000,
  });

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
      duration: number = 3000,
      action?: { label: string; onPress: () => void },
    ) => {
      setToast({
        visible: true,
        message,
        type,
        duration,
        actionLabel: action?.label,
        onAction: action?.onPress,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  /**
   * Helper para operações assíncronas com feedback automático
   *
   * @example
   * ```tsx
   * await withToast(
   *   async () => {
   *     await supabase.from('users').update(...)
   *   },
   *   {
   *     loading: 'Salvando...',
   *     success: 'Salvo com sucesso!',
   *     error: 'Erro ao salvar',
   *   }
   * );
   * ```
   */
  const withToast = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      messages: {
        loading: string;
        success: string;
        error?: string;
      },
    ): Promise<T> => {
      try {
        showToast(messages.loading, 'loading', 0);
        const result = await asyncFn();
        showToast(messages.success, 'success');
        return result;
      } catch (error: unknown) {
        const errorMessage =
          messages.error ||
          (error instanceof Error ? error.message : 'Ocorreu um erro');
        showToast(errorMessage, 'error', 5000);
        throw error;
      }
    },
    [showToast],
  );

  return {
    toast,
    showToast,
    hideToast,
    withToast,
  };
}
