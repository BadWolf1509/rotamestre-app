/**
 * Religa o rastreamento em segundo plano de uma rota que já está em andamento.
 *
 * POR QUE EXISTE. Só o `startRoute` ligava a task. Numa reinstalação ou
 * limpeza de dados no meio da rota, a task e o contexto somem e nada os
 * religava — o gestor perdia a posição do motorista em silêncio (medido em
 * 08/09/2026). Este hook confere na abertura e a cada volta ao primeiro plano.
 *
 * Só consulta. Sem "Permitir o tempo todo", não pede de surpresa: expõe um
 * aviso dispensável, e o toque nele entra no `requestAndStartTracking`, que
 * mostra a divulgação destacada exigida pelo Google antes do diálogo do
 * Android.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import type { RouteData } from '@/context/route-status/types';
import { logger } from '@/lib/logger';
import {
  garantirRastreamentoDaRota,
  requestAndStartTracking,
  type TrackingContext,
} from '@/services/unifiedLocationTracking';

interface Opcoes {
  route: RouteData | null;
  motorista: { id: string; nome?: string } | null;
}

export interface RastreamentoSegundoPlano {
  /** Falta "Permitir o tempo todo" e o motorista não dispensou o aviso. */
  avisoVisivel: boolean;
  /** Fluxo existente: divulgação destacada → pedido do Android → inicia. */
  ativar: () => Promise<void>;
  dispensar: () => void;
}

export function useGarantirRastreamentoDaRota({
  route,
  motorista,
}: Opcoes): RastreamentoSegundoPlano {
  const [avisoVisivel, setAvisoVisivel] = useState(false);
  // Dispensar vale enquanto o app vive: sem isto, cada volta ao primeiro
  // plano (bloquear/desbloquear a tela já conta) reabriria o aviso.
  const dispensadoRef = useRef(false);
  const emVooRef = useRef(false);

  const rotaId = route?.id;
  const ativa =
    Platform.OS !== 'web' && route?.status === 'em_andamento' && !!motorista;
  const iniciadaEm = route?.iniciada_em;
  const motoristaId = motorista?.id;
  const motoristaNome = motorista?.nome;

  const montarContexto = useCallback(
    (): TrackingContext | null =>
      ativa && rotaId && motoristaId
        ? {
            rotaId,
            motoristaId,
            motoristaNome: motoristaNome || 'Motorista',
            startedAt: iniciadaEm ?? new Date().toISOString(),
          }
        : null,
    [ativa, rotaId, motoristaId, motoristaNome, iniciadaEm],
  );

  const verificar = useCallback(async () => {
    const contexto = montarContexto();
    if (!contexto) {
      setAvisoVisivel(false);
      return;
    }
    // A abertura e o `active` do AppState chegam juntos; duas conferências
    // simultâneas veriam a task ausente e iniciariam o serviço duas vezes.
    if (emVooRef.current) return;
    emVooRef.current = true;
    try {
      const resultado = await garantirRastreamentoDaRota(contexto);
      if (resultado === 'religado') {
        logger.info('[Rastreamento] Task de localização religada', rotaId);
      }
      setAvisoVisivel(
        resultado === 'sem-segundo-plano' && !dispensadoRef.current,
      );
    } finally {
      emVooRef.current = false;
    }
  }, [montarContexto, rotaId]);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  useEffect(() => {
    if (!ativa) return;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void verificar();
    });
    return () => assinatura.remove();
  }, [ativa, verificar]);

  const ativar = useCallback(async () => {
    const contexto = montarContexto();
    if (!contexto) return;
    await requestAndStartTracking(contexto);
    await verificar();
  }, [montarContexto, verificar]);

  const dispensar = useCallback(() => {
    dispensadoRef.current = true;
    setAvisoVisivel(false);
  }, []);

  // Vai para o valor do contexto: identidade nova a cada render re-renderiza
  // todos os consumidores do RouteStatus.
  return useMemo(
    () => ({ avisoVisivel, ativar, dispensar }),
    [avisoVisivel, ativar, dispensar],
  );
}
