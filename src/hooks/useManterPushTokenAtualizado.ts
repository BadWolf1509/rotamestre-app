/**
 * Mantém o registro do aparelho (push) atualizado: reenvia ao abrir o app e ao
 * voltar ao primeiro plano. O intervalo mínimo e as regras (sessão, permissão,
 * rede) vivem em `atualizarRegistroDePush`; aqui só se liga o gatilho.
 * Montado uma vez, na raiz (`app/_layout.tsx`).
 *
 * "Abrir" é por PROCESSO, não por montagem: a flag fica no módulo (um `useRef`
 * se perderia numa remontagem da raiz e viraria nova abertura forçada).
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { atualizarRegistroDePush } from '@/lib/notifications';

let aberturaJaReenviada = false;

/** Só para testes: volta ao estado de processo novo. */
export function reiniciarAberturaDoPush(): void {
  aberturaJaReenviada = false;
}

export function useManterPushTokenAtualizado(): void {
  useEffect(() => {
    const abertura = !aberturaJaReenviada;
    aberturaJaReenviada = true;
    void atualizarRegistroDePush({ forcar: abertura });

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
