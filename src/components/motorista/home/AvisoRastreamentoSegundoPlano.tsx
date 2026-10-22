/**
 * Aviso de que a rota em andamento não está sendo acompanhada com o app
 * fechado. Dispensável e nunca modal: aparece na abertura do app, e um modal
 * ali seria ruído diário. O botão entra no fluxo com a divulgação destacada
 * (`requestAndStartTracking`) — ver `useGarantirRastreamentoDaRota`.
 */
import React from 'react';

import { Alert as AlertInline } from '@/components/Alert';
import { useRouteStatus } from '@/context/RouteStatusContext';

export function AvisoRastreamentoSegundoPlano() {
  const { rastreamentoSegundoPlano } = useRouteStatus();
  if (!rastreamentoSegundoPlano?.avisoVisivel) return null;

  return (
    <AlertInline
      type="warning"
      title="Rota sem acompanhamento com o app fechado"
      message="Com o app fechado, o gestor não vê onde você está. Ative a localização em segundo plano para manter o acompanhamento."
      actionLabel="Ativar"
      onAction={() => {
        void rastreamentoSegundoPlano.ativar();
      }}
      onClose={rastreamentoSegundoPlano.dispensar}
      testID="aviso-rastreamento-segundo-plano"
    />
  );
}
