/**
 * Estado da fila de ações de parada (concluir/pular sem rede) para a tela:
 * o que ainda espera envio e os avisos de ações descartadas por conflito
 * (parada removida, rota passada a outro motorista ou encerrada).
 *
 * A fila mora em `src/lib/motorista/filaAcoesParada.ts`; este hook só lê e
 * acompanha as mudanças (enfileirar, enviar, descartar avisam os ouvintes).
 *
 * `acoesDeOutraConta`: ações deixadas no aparelho por OUTRA conta (só sobem
 * com a sessão dela). Só o número sai daqui — nada da outra pessoa. Dispensar
 * o aviso é só da tela: as ações continuam na fila; ele volta se o número
 * mudar.
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
  const [deOutraConta, setDeOutraConta] = useState(0);
  // A dispensa vale para a conta que dispensou: trocar de conta a zera.
  const [dispensa, setDispensa] = useState<{
    motoristaId: string | null | undefined;
    contagem: number;
  } | null>(null);

  useEffect(() => {
    if (!motoristaId) {
      setAcoes([]);
      setDescartes([]);
      setDeOutraConta(0);
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
      setDeOutraConta(fila.filter((a) => a.motoristaId !== motoristaId).length);
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

  const dispensarAvisoOutraConta = useCallback(() => {
    setDispensa({ motoristaId, contagem: deOutraConta });
  }, [deOutraConta, motoristaId]);

  const acoesDeOutraConta =
    dispensa !== null &&
    dispensa.motoristaId === motoristaId &&
    dispensa.contagem === deOutraConta
      ? 0
      : deOutraConta;

  return {
    acoes,
    descartes,
    dispensarDescartes,
    acoesDeOutraConta,
    dispensarAvisoOutraConta,
  };
}
