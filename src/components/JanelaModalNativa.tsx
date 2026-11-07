/**
 * Casca única dos modais nativos (R-UI-5): `Modal` do React Native + raiz do
 * Gesture Handler.
 *
 * No Android o Modal abre numa janela nativa à parte, que o
 * GestureHandlerRootView da raiz (app/_layout.tsx) não alcança: sem uma raiz
 * própria DENTRO do Modal, gesto do Gesture Handler não recebe toque (o
 * arrasto do Reordenar travava; commit c80f80a2). Antes a correção vivia
 * copiada em `Modal` e `DesktopModal`; quem abrir um modal nativo novo com
 * conteúdo arrastável usa esta casca em vez de repeti-la.
 */

import React from 'react';
import { Modal as RNModal, type ModalProps } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const RAIZ_DE_GESTOS_DO_MODAL = { flex: 1 } as const;

export function JanelaModalNativa({ children, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      <GestureHandlerRootView style={RAIZ_DE_GESTOS_DO_MODAL}>
        {children}
      </GestureHandlerRootView>
    </RNModal>
  );
}
