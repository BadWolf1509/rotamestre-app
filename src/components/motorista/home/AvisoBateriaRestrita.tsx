/**
 * Aviso de que o uso de bateria "Restrito" vai cortar o acompanhamento da rota
 * assim que o app sair da tela. Dispensável e nunca modal, no padrão do
 * `AvisoRastreamentoSegundoPlano`. O botão abre a tela de bateria do próprio
 * app — ver `src/lib/restricaoSegundoPlano.ts`.
 */
import React from 'react';

import { Alert as AlertInline } from '@/components/Alert';
import { useRouteStatus } from '@/context/RouteStatusContext';
import { useBateriaRestrita } from '@/hooks/motorista/useBateriaRestrita';

export function AvisoBateriaRestrita() {
  const { route } = useRouteStatus();
  const aviso = useBateriaRestrita({ ativa: route?.status === 'em_andamento' });
  if (!aviso.avisoVisivel) return null;

  return (
    <AlertInline
      type="warning"
      title="Bateria restrita: o acompanhamento vai parar"
      message="Com o app fora da tela, o Android corta a localização e as notificações. Na tela que abrir, ative “Permitir o uso em segundo plano” (ou escolha “Sem restrições”)."
      actionLabel="Ajustar bateria"
      onAction={() => {
        void aviso.abrirConfiguracoes();
      }}
      onClose={aviso.dispensar}
      testID="aviso-bateria-restrita"
    />
  );
}
