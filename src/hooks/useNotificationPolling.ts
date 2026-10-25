import { useEffect, useRef } from "react";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import type { NotificacaoComDetalhes } from "@/types/notifications";

/** Mesmo recorte da lista do provider: a notificação nova entra pronta. */
export const SELECT_NOTIFICACAO_COM_DETALHES = `
  *,
  rota:rotas(data, status),
  parada:paradas(endereco, ordem),
  incidente:incidentes(categoria, descricao)
`;

const INTERVALO_MS = 30000;
const LIMITE_POR_BUSCA = 20;

interface UseNotificationPollingOptions {
  userId: string | undefined;
  /** true quando o realtime está fora: só então o polling roda (DP-5). */
  ativo: boolean;
  /** `created_at` da notificação mais nova já vista; null se nenhuma. */
  desde: string | null;
  onNovas: (novas: NotificacaoComDetalhes[]) => void;
}

/**
 * Reserva do realtime de notificações.
 *
 * Só roda com o realtime fora (`ativo`) e busca só o que chegou desde a
 * última notificação vista — antes baixava TODAS as não lidas a cada 30 s,
 * com o canal de pé ou não (DP-5). Usa `gte` (e não `gt`) para não perder uma
 * notificação gravada no mesmo instante da última vista; a repetida sai na
 * deduplicação por id de quem recebe.
 *
 * Quando o realtime volta (`ativo` true → false) faz UMA busca de recuperação:
 * entre o último evento e o SUBSCRIBED o canal não ouviu nada. É também o que
 * fecha a janela entre a carga inicial e a primeira inscrição.
 */
export function useNotificationPolling({
  userId,
  ativo,
  desde,
  onNovas,
}: UseNotificationPollingOptions) {
  // Refs: mudar a última vista ou o callback não reinicia o intervalo.
  const desdeRef = useRef(desde);
  const onNovasRef = useRef(onNovas);
  useEffect(() => {
    desdeRef.current = desde;
  }, [desde]);
  useEffect(() => {
    onNovasRef.current = onNovas;
  }, [onNovas]);

  // Contador de geração: resposta de uma conta anterior (ou de um hook já
  // desmontado) não entrega nada.
  const geracaoRef = useRef(0);
  useEffect(() => {
    geracaoRef.current += 1;
    return () => {
      geracaoRef.current += 1;
    };
  }, [userId]);

  const buscarNovasRef = useRef<(() => Promise<void>) | null>(null);
  buscarNovasRef.current = async () => {
    if (!userId) return;
    const geracao = geracaoRef.current;
    try {
      let consulta = supabase
        .from("notificacoes")
        .select(SELECT_NOTIFICACAO_COM_DETALHES)
        .eq("usuario_id", userId);
      if (desdeRef.current) {
        consulta = consulta.gte("created_at", desdeRef.current);
      }
      const { data, error } = await consulta
        .order("created_at", { ascending: false })
        .limit(LIMITE_POR_BUSCA);

      if (geracao !== geracaoRef.current) return;
      if (error) {
        logger.warn("[Polling:Notificacoes] Falha ao buscar novas", error);
        return;
      }
      const novas = (data ?? []) as NotificacaoComDetalhes[];
      if (novas.length > 0) onNovasRef.current(novas);
    } catch (error) {
      logger.warn("[Polling:Notificacoes] Falha ao buscar novas", error);
    }
  };

  useEffect(() => {
    if (!userId || !ativo) return;

    const intervalo = setInterval(() => {
      buscarNovasRef.current?.();
    }, INTERVALO_MS);

    return () => {
      clearInterval(intervalo);
    };
  }, [userId, ativo]);

  // Recuperação: o realtime acabou de voltar.
  const ativoAnteriorRef = useRef(ativo);
  useEffect(() => {
    const voltou = ativoAnteriorRef.current && !ativo;
    ativoAnteriorRef.current = ativo;
    if (voltou && userId) buscarNovasRef.current?.();
  }, [ativo, userId]);
}
