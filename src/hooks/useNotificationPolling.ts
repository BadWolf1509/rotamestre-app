import { useEffect, useRef } from 'react';

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import type { NotificacaoComDetalhes } from '@/types/notifications';

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
  /**
   * Chamado uma vez quando o realtime volta, além da busca das novas: a busca
   * só traz INSERTs, e o que mudou enquanto o canal esteve fora (lida, apagada)
   * só aparece recarregando a lista.
   */
  onRecuperar?: () => void;
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
 * fecha a janela entre a carga inicial e a primeira inscrição. Se `onRecuperar`
 * existir, ele roda junto, para a lista inteira ser recarregada — mas não no
 * primeiro SUBSCRIBED rápido da conta, logo depois da carga inicial.
 */
export function useNotificationPolling({
  userId,
  ativo,
  desde,
  onNovas,
  onRecuperar,
}: UseNotificationPollingOptions) {
  // Refs: mudar a última vista ou o callback não reinicia o intervalo.
  const desdeRef = useRef(desde);
  const onNovasRef = useRef(onNovas);
  const onRecuperarRef = useRef(onRecuperar);
  useEffect(() => {
    desdeRef.current = desde;
  }, [desde]);
  useEffect(() => {
    onNovasRef.current = onNovas;
  }, [onNovas]);
  useEffect(() => {
    onRecuperarRef.current = onRecuperar;
  }, [onRecuperar]);

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
        .from('notificacoes')
        .select(SELECT_NOTIFICACAO_COM_DETALHES)
        .eq('usuario_id', userId);
      if (desdeRef.current) {
        consulta = consulta.gte('created_at', desdeRef.current);
      }
      const { data, error } = await consulta
        .order('created_at', { ascending: false })
        .limit(LIMITE_POR_BUSCA);

      if (geracao !== geracaoRef.current) return;
      if (error) {
        logger.warn('[Polling:Notificacoes] Falha ao buscar novas', error);
        return;
      }
      const novas = (data ?? []) as NotificacaoComDetalhes[];
      if (novas.length > 0) onNovasRef.current(novas);
    } catch (error) {
      logger.warn('[Polling:Notificacoes] Falha ao buscar novas', error);
    }
  };

  // Para a recuperação (abaixo): o canal desta conta já esteve de pé? E
  // quantos ciclos do polling rodaram desde que ele caiu?
  const jaConectouRef = useRef(false);
  const ciclosNaAusenciaRef = useRef(0);

  useEffect(() => {
    if (!userId || !ativo) return;

    const intervalo = setInterval(() => {
      ciclosNaAusenciaRef.current += 1;
      buscarNovasRef.current?.();
    }, INTERVALO_MS);

    return () => {
      clearInterval(intervalo);
    };
  }, [userId, ativo]);

  // Recuperação: o realtime acabou de voltar.
  //
  // `onRecuperar` (recarga da lista inteira) só quando a lista pode estar
  // velha: o canal desta conta já esteve de pé e caiu, OU a ausência durou
  // ao menos um ciclo do polling. No primeiro SUBSCRIBED da abertura/login a
  // carga inicial do provider acabou de trazer a lista — recarregar ali era
  // carga dupla. A busca das novas continua sempre: ela fecha a janela entre
  // a carga inicial e a inscrição. Comparado: só "já conectou" deixaria sem
  // recarga a abertura em que o canal demorou minutos para subir (a lista
  // da carga inicial envelhece); uma flag vinda do provider espalharia a
  // regra por dois arquivos.
  const ativoAnteriorRef = useRef(ativo);
  useEffect(() => {
    // Troca de conta: o canal da conta nova ainda não conectou.
    jaConectouRef.current = false;
    ciclosNaAusenciaRef.current = 0;
  }, [userId]);
  useEffect(() => {
    const voltou = ativoAnteriorRef.current && !ativo;
    ativoAnteriorRef.current = ativo;
    if (voltou && userId) {
      buscarNovasRef.current?.();
      if (jaConectouRef.current || ciclosNaAusenciaRef.current > 0) {
        onRecuperarRef.current?.();
      }
    }
    if (!ativo) {
      jaConectouRef.current = true;
      ciclosNaAusenciaRef.current = 0;
    }
  }, [ativo, userId]);
}
