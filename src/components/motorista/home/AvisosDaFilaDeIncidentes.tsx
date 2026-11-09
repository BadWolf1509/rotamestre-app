/**
 * Avisos da fila de incidentes reportados sem rede: quantos reportes desta
 * conta ainda não subiram e quais o servidor recusou (a rota passou a outro
 * motorista, por exemplo). Nunca modal; a recusa se dispensa. A fila mora em
 * `src/lib/motorista/filaIncidentes.ts`.
 */
import React from 'react';

import { Alert as AlertInline } from '@/components/Alert';
import { useFilaIncidentes } from '@/hooks/motorista/useFilaIncidentes';
import type {
  DescarteDeIncidente,
  MotivoDescarteIncidente,
} from '@/lib/motorista/filaIncidentes';

const MOTIVO: Record<MotivoDescarteIncidente, string> = {
  recusado:
    'o servidor recusou — a rota ou a parada pode ter mudado; fale com o gestor',
  falha_persistente: 'o servidor recusou o envio várias vezes',
};

function resumo(descricao: string): string {
  const texto = descricao.trim();
  return texto.length > 50 ? `${texto.slice(0, 47)}...` : texto;
}

function mensagemDosDescartes(descartes: DescarteDeIncidente[]): string {
  return descartes
    .map((d) => `"${resumo(d.incidente.descricao)}": ${MOTIVO[d.motivo]}.`)
    .join('\n');
}

export function AvisosDaFilaDeIncidentes({
  motoristaId,
}: {
  motoristaId: string | null | undefined;
}) {
  const { pendentes, descartes, dispensarDescartes } =
    useFilaIncidentes(motoristaId);

  if (pendentes === 0 && descartes.length === 0) return null;

  return (
    <>
      {pendentes > 0 && (
        <AlertInline
          type="info"
          title={
            pendentes > 1
              ? `${pendentes} reportes de problema aguardando envio`
              : '1 reporte de problema aguardando envio'
          }
          message="Registrados sem internet. Sobem sozinhos quando a conexão voltar — não precisa refazer."
          testID="aviso-incidente-pendente"
        />
      )}
      {descartes.length > 0 && (
        <AlertInline
          type="warning"
          title={
            descartes.length > 1
              ? `${descartes.length} reportes de problema não foram enviados`
              : 'Um reporte de problema não foi enviado'
          }
          message={mensagemDosDescartes(descartes)}
          onClose={() => {
            void dispensarDescartes();
          }}
          testID="aviso-incidente-descartado"
        />
      )}
    </>
  );
}
