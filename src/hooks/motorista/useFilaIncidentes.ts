/**
 * Estado da fila de incidentes reportados sem rede, para a tela: quantos
 * reportes desta conta ainda esperam envio e os que o servidor recusou.
 *
 * A fila mora em `src/lib/motorista/filaIncidentes.ts`; este hook só lê e
 * acompanha as mudanças (enfileirar, enviar, descartar avisam os ouvintes).
 * Itens de outra conta não aparecem: só sobem com a sessão dela.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  dispensarDescartesDeIncidentes,
  lerDescartesDeIncidentes,
  lerFilaIncidentes,
  ouvirFilaIncidentes,
  type DescarteDeIncidente,
} from '@/lib/motorista/filaIncidentes';

export function useFilaIncidentes(motoristaId: string | null | undefined) {
  const [pendentes, setPendentes] = useState(0);
  const [descartes, setDescartes] = useState<DescarteDeIncidente[]>([]);
  // Leitura velha não sobrescreve a nova: cada `ler` leva o seu número.
  const leituraRef = useRef(0);

  useEffect(() => {
    if (!motoristaId) {
      leituraRef.current++;
      setPendentes(0);
      setDescartes([]);
      return;
    }
    let ativo = true;
    const ler = async () => {
      const leitura = ++leituraRef.current;
      const [fila, avisos] = await Promise.all([
        lerFilaIncidentes(),
        lerDescartesDeIncidentes(motoristaId),
      ]);
      if (!ativo || leitura !== leituraRef.current) return;
      setPendentes(fila.filter((i) => i.motoristaId === motoristaId).length);
      setDescartes(avisos);
    };
    void ler();
    const parar = ouvirFilaIncidentes(() => {
      void ler();
    });
    return () => {
      ativo = false;
      parar();
    };
  }, [motoristaId]);

  const dispensarDescartes = useCallback(async () => {
    if (!motoristaId) return;
    try {
      await dispensarDescartesDeIncidentes(motoristaId);
    } catch (error) {
      // Lista ilegível (OFF-4): o aviso só não some; dá para tentar de novo.
      logger.warn('[FilaIncidentes] Falha ao dispensar avisos', error);
    }
  }, [motoristaId]);

  return { pendentes, descartes, dispensarDescartes };
}
