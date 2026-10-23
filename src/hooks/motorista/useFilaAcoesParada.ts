/**
 * Estado da fila de ações de parada (concluir/pular sem rede) para a tela:
 * o que ainda espera envio e os avisos de ações descartadas por conflito
 * (parada removida, rota passada a outro motorista ou encerrada).
 *
 * A fila mora em `src/lib/motorista/filaAcoesParada.ts`; este hook só lê e
 * acompanha as mudanças (enfileirar, enviar, descartar avisam os ouvintes).
 */
import { useCallback, useEffect, useState } from 'react';

import {
  dispensarDescartes as dispensar,
  lerDescartesDaFila,
  lerFilaAcoesParada,
  ouvirFilaAcoesParada,
  type AcaoParada,
  type DescarteDeAcao,
} from '@/lib/motorista/filaAcoesParada';

export function useFilaAcoesParada(motoristaId: string | null | undefined) {
  const [acoes, setAcoes] = useState<AcaoParada[]>([]);
  const [descartes, setDescartes] = useState<DescarteDeAcao[]>([]);

  useEffect(() => {
    if (!motoristaId) {
      setAcoes([]);
      setDescartes([]);
      return;
    }
    let ativo = true;
    const ler = async () => {
      const [fila, avisos] = await Promise.all([
        lerFilaAcoesParada(),
        lerDescartesDaFila(motoristaId),
      ]);
      if (!ativo) return;
      setAcoes(fila.filter((a) => a.motoristaId === motoristaId));
      setDescartes(avisos);
    };
    void ler();
    const parar = ouvirFilaAcoesParada(() => {
      void ler();
    });
    return () => {
      ativo = false;
      parar();
    };
  }, [motoristaId]);

  const dispensarDescartes = useCallback(async () => {
    if (motoristaId) await dispensar(motoristaId);
  }, [motoristaId]);

  return { acoes, descartes, dispensarDescartes };
}
