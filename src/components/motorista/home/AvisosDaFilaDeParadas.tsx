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
import type {
  DescarteDeAcao,
  MotivoDescarte,
} from '@/lib/motorista/filaAcoesParada';

const MOTIVO: Record<MotivoDescarte, string> = {
  parada_removida:
    'a parada foi removida ou a rota foi passada para outro motorista',
  rota_encerrada: 'a rota não estava mais em andamento',
  status_divergente:
    'a parada já tinha sido concluída ou pulada por outro caminho',
  falha_persistente: 'o servidor recusou o envio várias vezes',
};

/**
 * O que acontece com a foto quando a conclusão é descartada, sem prometer
 * além do que existe: ela continua no aparelho até subir
 * (`subirFotoDaFilaOffline` em `src/lib/storage.ts`) — o que pode não
 * acontecer, se o vínculo do motorista com a loja for desativado — e, se não
 * puder ser ligada à parada, o caminho fica num registro (`logs`) que nenhuma
 * tela mostra ainda: recuperar depende do suporte.
 */
const SOBRE_A_FOTO =
  'A foto do comprovante, se houver, continua guardada e é enviada assim que for possível; se não puder ser ligada à parada, fica registrada para a loja recuperar com o suporte.';

/**
 * Uma linha por descarte, com a parada identificada (o rótulo guardado ao
 * enfileirar; ações de versões anteriores não o têm), e o parágrafo da foto
 * uma vez só, no fim, se alguma conclusão foi descartada.
 */
function mensagemDosDescartes(descartes: DescarteDeAcao[]): string {
  const linhas = descartes.map((d) => {
    const oQue =
      d.acao.tipo === 'concluir' ? 'conclusão não enviada' : 'pulo não enviado';
    const quem = d.acao.rotulo ?? 'Parada';
    return `${quem}: ${oQue} (${MOTIVO[d.motivo]}).`;
  });
  if (descartes.some((d) => d.acao.tipo === 'concluir')) {
    linhas.push(SOBRE_A_FOTO);
  }
  return linhas.join('\n');
}

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
          message={mensagemDosDescartes(descartes)}
          onClose={() => {
            void dispensarAvisosDeEnvio?.();
          }}
          testID="aviso-envio-descartado"
        />
      )}
    </>
  );
}
