/**
 * Pular uma parada e, se o motorista pediu ("Pular também"), os outros
 * serviços do mesmo local, com o aviso de sucesso ou de falha parcial.
 * Compartilhado pela Início e pela aba Paradas, que abrem o mesmo
 * `SkipReasonModal`.
 */

import { useCallback } from 'react';

import { SKIP_REASON_LABELS, type MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData } from '@/context/route-status/types';
import { getErrorMessage } from '@/lib/errorMapping';
import { AVISO_ENVIO_PENDENTE } from '@/lib/motorista/filaAcoesParada';
import {
  avisoDeFalhaNoPulo,
  pularEmSequencia,
  type ResultadoDoPulo,
} from '@/lib/motorista/puloDaVisita';
import { paradasDaVisita } from '@/lib/motorista/visitaNoLocal';

interface Params {
  paradas: ParadaData[];
  skipStop: (
    paradaId: string,
    motivo: MotivoSkip,
    observacoes?: string,
  ) => Promise<unknown>;
  showSuccess: (title: string, message: string) => void;
  showError: (errorOrOptions: unknown) => void;
}

export function usePuloDaVisita({
  paradas,
  skipStop,
  showSuccess,
  showError,
}: Params) {
  return useCallback(
    async (
      parada: ParadaData,
      motivo: MotivoSkip,
      observacoes?: string,
      incluirOutros?: boolean,
    ): Promise<ResultadoDoPulo> => {
      // Em sequência, a parada primeiro: se um pulo falhar, os seguintes não
      // rodam e o sucesso não é anunciado.
      const alvos = incluirOutros ? paradasDaVisita(paradas, parada) : [parada];
      const resultado = await pularEmSequencia(alvos, (alvo) =>
        skipStop(alvo.id, motivo, observacoes),
      );
      const { pulados, falha } = resultado;
      if (!falha) {
        showSuccess(
          alvos.length > 1 ? 'Paradas Puladas' : 'Parada Pulada',
          resultado.naFila
            ? `${SKIP_REASON_LABELS[motivo]}
${AVISO_ENVIO_PENDENTE}`
            : SKIP_REASON_LABELS[motivo],
        );
      } else if (alvos.length > 1) {
        // Com vários serviços, o erro genérico não diz o que já foi pulado.
        showError(
          avisoDeFalhaNoPulo(
            pulados,
            falha,
            getErrorMessage(falha.erro).message,
          ),
        );
      } else {
        showError(falha.erro);
      }
      return resultado;
    },
    [paradas, skipStop, showSuccess, showError],
  );
}
