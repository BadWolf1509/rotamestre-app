/**
 * Avisos da fila de ações de parada (concluir/pular feitos sem rede):
 * quantas paradas ainda não subiram, e quais ações o servidor recusou por
 * conflito — parada removida pelo gestor, rota passada a outro motorista ou
 * encerrada. Nunca modal; o descarte se dispensa. A fila mora em
 * `src/lib/motorista/filaAcoesParada.ts`.
 */
import React from 'react';

import { Alert as AlertInline } from '@/components/Alert';
import { useRouteStatus } from '@/context/RouteStatusContext';
import type { MotivoDescarte } from '@/lib/motorista/filaAcoesParada';

const MOTIVO: Record<MotivoDescarte, string> = {
  parada_removida:
    'a parada foi removida ou a rota foi passada para outro motorista',
  rota_encerrada: 'a rota não estava mais em andamento',
  status_divergente:
    'a parada já tinha sido concluída ou pulada por outro caminho',
  falha_persistente: 'o servidor recusou o envio várias vezes',
};

export function AvisosDaFilaDeParadas() {
  const { paradasComEnvioPendente, avisosDeEnvio, dispensarAvisosDeEnvio } =
    useRouteStatus();

  const pendentes = paradasComEnvioPendente?.size ?? 0;
  const descartes = avisosDeEnvio ?? [];
  if (pendentes === 0 && descartes.length === 0) return null;

  return (
    <>
      {pendentes > 0 && (
        <AlertInline
          type="info"
          title={
            pendentes > 1
              ? `${pendentes} paradas aguardando envio`
              : '1 parada aguardando envio'
          }
          message="Registradas sem internet. Sobem sozinhas quando o sinal voltar — não precisa refazer."
          testID="aviso-envio-pendente"
        />
      )}
      {descartes.length > 0 && (
        <AlertInline
          type="warning"
          title={
            descartes.length > 1
              ? `${descartes.length} registros não foram enviados`
              : 'Um registro não foi enviado'
          }
          message={descartes
            .map(
              (d) =>
                `${d.acao.tipo === 'concluir' ? 'Conclusão' : 'Pulo'} não enviado: ${MOTIVO[d.motivo]}.`,
            )
            .join('\n')}
          onClose={() => {
            void dispensarAvisosDeEnvio?.();
          }}
          testID="aviso-envio-descartado"
        />
      )}
    </>
  );
}
