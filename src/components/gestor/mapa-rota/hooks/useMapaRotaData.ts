/**
 * Hook para carregar e processar dados da rota
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ShowToast } from '@/hooks/useToast';
import { buscarNomesForaDaLoja } from '@/lib/gestor/nomesMotoristasForaDaLoja';
import { logger } from '@/lib/logger';
import { nomeDeCanalUnico } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

import type { Parada, Rota, ResumoParadas } from '../types';

/** Junta a rajada de eventos de uma conclusão numa recarga só. */
const DEBOUNCE_RECARGA_MS = 300;

interface UseMapaRotaDataOptions {
  rotaId: string | string[] | undefined;
  onError?: () => void;
  /**
   * O `showToast` da instância de `useToast` que a PÁGINA renderiza. É
   * obrigatório de propósito: `useToast` é estado local, e um hook que criasse
   * a própria instância mostraria o toast para ninguém.
   */
  showToast: ShowToast;
}

interface UseMapaRotaDataResult {
  /** `true` só até a primeira carga terminar; recargas nunca o religam. */
  loading: boolean;
  rota: Rota | null;
  paradas: Parada[];
  paradasReais: Parada[];
  pontosBase: Parada[];
  resumoParadas: ResumoParadas;
  enderecoUnidade: { latitude: number; longitude: number } | null;
  /**
   * Recarga sem skeleton: chame depois de salvar (adicionar, editar, remover,
   * reordenar). Falha só é registrada e a tela segue com o último retrato.
   */
  recarregarSilencioso: () => Promise<void>;
}

/**
 * Hook for loading and processing route data
 */
export function useMapaRotaData({
  rotaId,
  onError,
  showToast,
}: UseMapaRotaDataOptions): UseMapaRotaDataResult {
  const [loading, setLoading] = useState(true);
  const [rota, setRota] = useState<Rota | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);

  // Computed values
  const paradasReais = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint !== false),
    [paradas],
  );

  const pontosBase = useMemo(
    () => paradas.filter((parada) => parada.is_checkpoint === false),
    [paradas],
  );

  const resumoParadas: ResumoParadas = useMemo(() => {
    const total = paradasReais.length;
    const concluidas = paradasReais.filter(
      (p) => p.status === 'concluida',
    ).length;
    const pendentes = paradasReais.filter(
      (p) => p.status === 'pendente',
    ).length;
    const emAndamento = paradasReais.filter(
      (p) => p.status === 'em_andamento',
    ).length;
    const puladas = paradasReais.filter((p) => p.status === 'pulada').length;
    return { total, concluidas, pendentes, emAndamento, puladas };
  }, [paradasReais]);

  const enderecoUnidade = useMemo(() => {
    const pontoBase = paradas.find((p) => p.is_checkpoint === false);
    if (pontoBase?.latitude && pontoBase?.longitude) {
      return {
        latitude: pontoBase.latitude,
        longitude: pontoBase.longitude,
      };
    }
    return null;
  }, [paradas]);

  // Cada carga leva um número; só a mais nova grava. Sem isso, a resposta
  // lenta de uma recarga antiga chegava depois da nova e voltava a tela no
  // tempo (parada "pendente" depois de "concluída").
  const sequenciaRef = useRef(0);

  // `true` depois que uma carga desta rota aplicou dados. Enquanto `false`,
  // QUALQUER carga (inclusive a silenciosa que o SUBSCRIBED dispara durante a
  // primeira) é a primeira de fato: ela desliga o skeleton e, se falhar, avisa
  // e chama `onError`. Sem isso, a recarga que descartava a 1ª carga deixava
  // o skeleton para sempre (e uma falha dela sumia sem aviso).
  const carregouRef = useRef(false);

  const id = Array.isArray(rotaId) ? rotaId[0] : rotaId;

  /**
   * Busca rota e paradas e grava no estado.
   *
   * `silenciosa` não liga o skeleton, e, depois da primeira carga, não avisa
   * por toast nem chama `onError`: o gestor está olhando a tela, e trocá-la
   * por skeleton remonta o mapa e os modais (foi o que cada ação fazia),
   * enquanto `onError` aqui é `router.back()`. Falha de recarga só vira log.
   */
  const carregar = useCallback(
    async (silenciosa: boolean) => {
      if (!id) return;
      const minha = ++sequenciaRef.current;

      try {
        if (!silenciosa) setLoading(true);

        const { data: rotaData, error: rotaError } = await supabase
          .from('rotas')
          .select(
            'id, data, status, distancia_total, tempo_total, polyline, created_at, updated_at, motorista_id, unidade_id, otimizacao_estado, usuarios!rotas_motorista_id_fkey(nome), unidades(nome)',
          )
          .eq('id', id)
          .single();

        if (rotaError) throw rotaError;

        const { data: paradasData, error: paradasError } = await supabase
          .from('paradas')
          .select('*')
          .eq('rota_id', id)
          .order('ordem');

        if (paradasError) throw paradasError;

        const motorista = Array.isArray(rotaData.usuarios)
          ? rotaData.usuarios[0]
          : rotaData.usuarios;
        // Motorista escondido pela RLS (vínculo inativo com a loja): o nome
        // vem da RPC da Migration 72. Esperado aqui, antes de gravar, e não
        // depois: assim a tela não pisca "Motorista removido da loja" a cada
        // recarga, e a conferência de sequência abaixo também descarta o nome
        // de uma carga velha. Só custa uma chamada quando o embed vem vazio.
        const nomesForaDaLoja =
          !motorista?.nome && rotaData.motorista_id
            ? await buscarNomesForaDaLoja([
                { id: rotaData.id, motorista_id: rotaData.motorista_id },
              ])
            : null;

        // Chegou outra carga depois desta: a resposta é velha.
        if (minha !== sequenciaRef.current) return;

        // Ordem inconsistente (chegada fora do fim) só é REGISTRADA. Abrir a
        // tela não escreve no banco: antes, isto chamava a normalização
        // (UPDATE em duas etapas nas paradas) só por o gestor ter aberto a
        // rota, e ignorava o resultado. Quem reescreve a ordem é a ação
        // explícita de reordenar (RPC `reordenar_paradas`).
        if (paradasData && paradasData.length > 0) {
          const chegada = paradasData.find(
            (p) => p.is_checkpoint === false && p.ordem > 0,
          );
          const paradasReaisArr = paradasData.filter(
            (p) => p.is_checkpoint !== false,
          );
          const expectedChegadaOrdem = paradasReaisArr.length + 1;

          if (chegada && chegada.ordem !== expectedChegadaOrdem) {
            logger.warn('[useMapaRotaData] ordem das paradas inconsistente', {
              rotaId: String(id),
              chegadaOrdem: chegada.ordem,
              expectedChegadaOrdem,
            });
          }
        }

        setRota({
          ...rotaData,
          motorista,
          motorista_fora_da_loja_nome:
            nomesForaDaLoja?.get(rotaData.id) ?? null,
          unidade: Array.isArray(rotaData.unidades)
            ? rotaData.unidades[0]
            : rotaData.unidades,
        });
        setParadas(paradasData || []);
        carregouRef.current = true;
        setLoading(false);
      } catch (error) {
        if (minha !== sequenciaRef.current) return;
        if (carregouRef.current) {
          logger.warn('[useMapaRotaData] Falha ao recarregar a rota', error);
        } else {
          logger.error('[useMapaRotaData] Erro ao carregar rota', error);
          showToast('Não foi possível carregar os dados da rota', 'error');
          setLoading(false);
          onError?.();
        }
      }
    },
    [id, showToast, onError],
  );

  /**
   * Recarga sem skeleton: é o que a tela chama depois de salvar e o que os
   * eventos de realtime disparam.
   */
  const recarregarSilencioso = useCallback(() => carregar(true), [carregar]);

  // O efeito do canal lê sempre a versão mais nova, sem depender dela.
  const recarregarRef = useRef(recarregarSilencioso);
  recarregarRef.current = recarregarSilencioso;

  // Primeira carga (e troca de rota): a única que mostra o skeleton.
  // `carregar` muda com `onError`/`showToast`; refazer o skeleton por isso é
  // o que este efeito NÃO deve fazer — só o id da rota o reinicia.
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;
  useEffect(() => {
    carregouRef.current = false;
    if (id) {
      void carregarRef.current(false);
    } else {
      setLoading(false);
    }
  }, [id]);

  // Realtime da rota aberta: o motorista conclui ou pula, o gestor edita em
  // outra aba, e esta tela acompanha sem recarregar a página.
  useEffect(() => {
    if (!id) return;

    let temporizador: ReturnType<typeof setTimeout> | null = null;
    // Concluir uma parada mexe em paradas, rotas e logs: a rajada vira uma
    // recarga só.
    const agendar = () => {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        void recarregarRef.current();
      }, DEBOUNCE_RECARGA_MS);
    };

    const canal = supabase
      .channel(nomeDeCanalUnico(`mapa-rota-${id}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paradas',
          filter: `rota_id=eq.${id}`,
        },
        agendar,
      )
      // Sem assinatura de DELETE: o Realtime não aplica RLS nele e, sem
      // filtro (o DELETE só carrega a PK), cada tela de rota receberia o id de
      // toda parada apagada em qualquer loja. A remoção chega aqui pelos
      // UPDATEs que ela dispara (reordenação das restantes, recálculo da
      // rota), e a tela de quem remove recarrega ao terminar.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rotas',
          filter: `id=eq.${id}`,
        },
        agendar,
      )
      .subscribe((status) => {
        // SUBSCRIBED na 1ª conexão cobre o que mudou entre a leitura inicial
        // e a assinatura; nas seguintes, o que se perdeu com o socket caído
        // (evento perdido não volta). Custa duas consultas leves.
        if (status === 'SUBSCRIBED') agendar();
      });

    return () => {
      if (temporizador) clearTimeout(temporizador);
      supabase.removeChannel(canal);
    };
  }, [id]);

  return {
    loading,
    rota,
    paradas,
    paradasReais,
    pontosBase,
    resumoParadas,
    enderecoUnidade,
    recarregarSilencioso,
  };
}
