/**
 * Os dois modais que concluem ou pulam uma parada do motorista, iguais na
 * Início, no Mapa e em Paradas. Componente de módulo (nunca declarado dentro
 * do render de outra tela — ver CLAUDE.md), que recebe o estado de quem o usa.
 *
 * Foi desse par copiado em cada tela que escapou o #565: o modo navegação
 * não montava os modais, e os botões abriam um modal que ninguém desenhava.
 */

import React from 'react';

import type { MotivoSkip } from '@/constants/skipReasons';
import type { ParadaData } from '@/context/route-status/types';
import { paradasDaVisita } from '@/lib/motorista/visitaNoLocal';

import { SkipReasonModal } from './SkipReasonModal';
import { StopCompletionFlow } from './StopCompletionFlow';

interface Props {
  /** Rota inteira: base para listar os outros serviços do mesmo local. */
  paradas: ParadaData[];
  /** Texto "Mais N serviços neste local" (de `useConclusaoEmSequencia`). */
  contexto: string | null;
  conclusao: {
    parada: ParadaData | null;
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void | Promise<void>;
  };
  pulo: {
    /** Parada a pular; `null` mantém o modal desmontado. */
    parada: ParadaData | null;
    onConfirm: (
      motivo: MotivoSkip,
      observacoes?: string,
      incluirOutros?: boolean,
    ) => void | Promise<void>;
    onCancel: () => void;
  };
}

export function ModaisDaParada({ paradas, contexto, conclusao, pulo }: Props) {
  return (
    <>
      <StopCompletionFlow
        parada={conclusao.parada}
        visible={conclusao.visible}
        onClose={conclusao.onClose}
        onSuccess={conclusao.onSuccess}
        allowSkipPhoto={true}
        contexto={contexto}
      />

      {pulo.parada && (
        <SkipReasonModal
          visible
          parada={pulo.parada}
          outrosServicosNoLocal={paradasDaVisita(paradas, pulo.parada).slice(1)}
          onConfirm={pulo.onConfirm}
          onCancel={pulo.onCancel}
        />
      )}
    </>
  );
}
