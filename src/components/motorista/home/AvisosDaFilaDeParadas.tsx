/**
 * Avisos da fila de ações de parada (concluir/pular feitos sem rede):
 * quantas paradas ainda não subiram, quantas ações de OUTRA conta esperam
 * neste aparelho (só o número), e quais ações o servidor recusou por
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
  const {
    paradasComEnvioPendente,
    avisosDeEnvio,
    dispensarAvisosDeEnvio,
    acoesDeOutraConta,
    dispensarAvisoOutraConta,
  } = useRouteStatus();

  const pendentes = paradasComEnvioPendente?.size ?? 0;
  const descartes = avisosDeEnvio ?? [];
  const deOutraConta = acoesDeOutraConta ?? 0;
  if (pendentes === 0 && descartes.length === 0 && deOutraConta === 0) {
    return null;
  }

  return (
    <>
      {deOutraConta > 0 && (
        // Só o número: quem é a outra conta e quais paradas não aparecem.
        <AlertInline
          type="info"
          message={
            deOutraConta > 1
              ? `Há ${deOutraConta} ações de outra conta guardadas neste aparelho; elas sobem quando essa conta entrar.`
              : 'Há 1 ação de outra conta guardada neste aparelho; ela sobe quando essa conta entrar.'
          }
          onClose={() => dispensarAvisoOutraConta?.()}
          testID="aviso-acoes-outra-conta"
        />
      )}
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
