/**
 * Conclusão em sequência: entrega e retirada no mesmo local são uma visita,
 * mas cada serviço tem o próprio comprovante. Ao concluir um, o fluxo do
 * próximo abre sozinho; cancelar não reabre nada.
 *
 * A fila é capturada em `iniciar`: `onSuccess` do StopCompletionFlow dispara
 * antes de a rota recarregar, então recalcular a partir de `paradas` leria o
 * estado velho. Quem chama `aoConcluir` deve fazê-lo depois de o modal atual
 * fechar, para o próximo remontar com passo e foto zerados.
 */

import { useCallback, useRef, useState } from 'react';

import type { ParadaData } from '@/context/route-status/types';
import { rotuloTipoParada } from '@/lib/motorista/rotuloTipoParada';
import { paradasDaVisita } from '@/lib/motorista/visitaNoLocal';

interface Params {
  paradas: ParadaData[];
  abrirConclusao: (parada: ParadaData) => void;
}

export function useConclusaoEmSequencia({ paradas, abrirConclusao }: Params) {
  // Ref para ler a fila na hora (aoConcluir pode vir de closure antigo);
  // state para o `contexto` renderizar.
  const filaRef = useRef<ParadaData[]>([]);
  const [fila, setFila] = useState<ParadaData[]>([]);

  const guardar = useCallback((nova: ParadaData[]) => {
    filaRef.current = nova;
    setFila(nova);
  }, []);

  const iniciar = useCallback(
    (parada: ParadaData) => {
      guardar(paradasDaVisita(paradas, parada));
      abrirConclusao(parada);
    },
    [paradas, abrirConclusao, guardar],
  );

  const aoConcluir = useCallback(
    (concluidaId: string) => {
      const restante = filaRef.current.filter((p) => p.id !== concluidaId);
      guardar(restante);
      if (restante.length > 0) abrirConclusao(restante[0]);
    },
    [abrirConclusao, guardar],
  );

  // A cabeça da fila é o serviço aberto; o aviso fala dos que vêm depois.
  const proximos = fila.slice(1);
  const contexto =
    proximos.length === 0
      ? null
      : `Mais ${proximos.length} ${proximos.length === 1 ? 'serviço' : 'serviços'} neste local: ${proximos
          .map((p) => rotuloTipoParada(p.tipo).titulo)
          .join(' + ')}`;

  return { iniciar, aoConcluir, contexto };
}
