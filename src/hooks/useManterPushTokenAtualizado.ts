/**
 * Mantém o registro do aparelho (push) atualizado: reenvia ao abrir o app e ao
 * voltar ao primeiro plano. O intervalo mínimo e as regras (sessão, permissão,
 * rede) vivem em `atualizarRegistroDePush`; aqui só se liga o gatilho.
 * Montado uma vez, na raiz (`app/_layout.tsx`).
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { atualizarRegistroDePush } from '../lib/notifications';

export function useManterPushTokenAtualizado(): void {
  useEffect(() => {
    void atualizarRegistroDePush({ forcar: true });

    const assinatura = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        if (estado === 'active') {
          void atualizarRegistroDePush({ forcar: false });
        }
      },
    );
    return () => assinatura.remove();
  }, []);
}
