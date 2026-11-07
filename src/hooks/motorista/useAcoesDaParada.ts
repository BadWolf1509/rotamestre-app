/**
 * Concluir e pular parada, o que as três telas do motorista (Início, Mapa e
 * Paradas) repetiam: a conclusão em sequência (entrega + retirada no mesmo
 * local), o pulo da visita e o `onSuccess` do `StopCompletionFlow`.
 *
 * O estado de qual modal está aberto continua de cada tela (reducer na Início,
 * `useState` nas outras) e entra aqui por parâmetro; o hook só junta a regra.
 * Alternativa descartada: um provider no layout do motorista com um único par
 * de modais — mexe na ordem de empilhamento dos `Modal` nativos e no foco do
 * web, num fluxo que já deu bugs só de aparelho (R-MOT-2, alternativa B).
 */

import { useCallback } from 'react';

import type { MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData } from '@/context/route-status/types';

import { useConclusaoEmSequencia } from './useConclusaoEmSequencia';
import { usePuloDaVisita } from './usePuloDaVisita';

interface Params {
  paradas: ParadaData[];
  skipStop: (
    paradaId: string,
    motivo: MotivoSkip,
    observacoes?: string,
  ) => Promise<unknown>;
  refreshRoute: () => Promise<unknown>;
  showSuccess: (title: string, message: string) => void;
  showError: (errorOrOptions: unknown) => void;
  /** Abre o `StopCompletionFlow` para a parada (estado da tela). */
  abrirConclusao: (parada: ParadaData) => void;
  /** Parada cujo fluxo de conclusão está aberto agora (estado da tela). */
  paradaEmConclusao: ParadaData | null;
}

export function useAcoesDaParada({
  paradas,
  skipStop,
  refreshRoute,
  showSuccess,
  showError,
  abrirConclusao,
  paradaEmConclusao,
}: Params) {
  const sequencia = useConclusaoEmSequencia({ paradas, abrirConclusao });
  const pularVisita = usePuloDaVisita({
    paradas,
    skipStop,
    showSuccess,
    showError,
  });

  // O StopCompletionFlow chama onSuccess e logo depois onClose. O próximo
  // serviço só abre depois do refresh, com o modal atual já fechado: abrir no
  // mesmo instante deixaria o onClose fechar o recém-aberto.
  const aoConcluirComSucesso = useCallback(async () => {
    const concluidaId = paradaEmConclusao?.id;
    await refreshRoute();
    if (concluidaId) sequencia.aoConcluir(concluidaId);
  }, [paradaEmConclusao?.id, refreshRoute, sequencia]);

  return { sequencia, pularVisita, aoConcluirComSucesso };
}
