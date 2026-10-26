/**
 * Hook para ações e handlers da página MapaRota
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList } from 'react-native';

import type { ShowToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import {
  cancelarRota,
  MENSAGEM_ROTA_JA_CANCELADA,
  MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR,
  MENSAGEM_SEM_PERMISSAO_ROTA,
  reativarRota,
  type ResultadoCancelarRota,
  type ResultadoReativarRota,
} from '@/lib/gestor/acoesRota';
import {
  mensagemParadaNaoAlteravel,
  podeAlterarParada,
} from '@/lib/gestor/paradaEditavel';
import { logger } from '@/lib/logger';
import {
  removerParadaERecalcular,
  reordenarParadas,
  recalcularRota,
  notificarMotoristaRotaEditada,
} from '@/lib/routeUtils';
import { supabase } from '@/lib/supabase';

import type { Parada, Rota } from '../types';

/**
 * Confere se um UPDATE realmente afetou algum registro, quando algum era
 * esperado.
 *
 * RLS pode barrar um UPDATE devolvendo 204 com ZERO linhas e `error: null`
 * (o `Prefer: return=minimal` default não distingue "0 linhas" de "N linhas"
 * sem `.select()` encadeado) — checar só `error` não basta. Por isso todo
 * UPDATE nesta tela encadeia `.select('id')` e passa o resultado por aqui —
 * ou, no UPDATE condicionado ao status da ROTA, por `assertRotaAtualizada`.
 * Cancelar e reativar não passam por aqui: vão pelas RPCs de `acoesRota`.
 *
 * A checagem é "afetou ZERO quando devia afetar alguma" (`esperado > 0`),
 * não "afetou MENOS que o esperado".
 */
function assertUpdateAfetouLinhas(
  data: { id: string }[] | null,
  error: unknown,
  esperado: number,
  mensagem: string,
): void {
  if (error) throw error;
  if (esperado > 0 && (data?.length ?? 0) === 0) {
    throw new Error(mensagem);
  }
}

/**
 * Aviso de rota que mudou de situação enquanto a tela estava aberta. Vem de
 * dois lugares: do resultado `situacao_mudou` das RPCs de cancelar e reativar
 * (o banco distingue isso de falta de permissão, que tem aviso próprio), e do
 * UPDATE de trocar motorista (só pendente) que volta com zero linhas — aí pode
 * ser também RLS, que o cliente não distingue. Nos dois casos o certo é o
 * mesmo: não anunciar sucesso e recarregar o estado real.
 */
export const MENSAGEM_ROTA_MUDOU =
  'A rota mudou de situação enquanto a tela estava aberta. A tela foi atualizada.';

/** Lançada quando o UPDATE condicional da rota não afetou nenhuma linha. */
class RotaMudouDeSituacao extends Error {
  constructor() {
    super('UPDATE da rota não afetou linhas (situação mudou ou RLS)');
    this.name = 'RotaMudouDeSituacao';
    // Mantém o `instanceof` confiável mesmo se o transpilador rebaixar a classe.
    Object.setPrototypeOf(this, RotaMudouDeSituacao.prototype);
  }
}

/** Como `assertUpdateAfetouLinhas`, para o UPDATE condicional da ROTA. */
function assertRotaAtualizada(
  data: { id: string }[] | null,
  error: unknown,
): void {
  if (error) throw error;
  if ((data?.length ?? 0) === 0) throw new RotaMudouDeSituacao();
}

interface UseMapaRotaHandlersOptions {
  rotaId: string | string[] | undefined;
  rota: Rota | null;
  paradas: Parada[];
  paradasReais: Parada[];
  enderecoUnidade: { latitude: number; longitude: number } | null;
  loadRotaEParadas: () => Promise<void>;
  /**
   * O `showToast` da instância de `useToast` que a PÁGINA renderiza. É
   * obrigatório de propósito: `useToast` é estado local, e um hook que criasse
   * a própria instância mostraria o toast para ninguém.
   */
  showToast: ShowToast;
}

interface UseMapaRotaHandlersResult {
  // Selection state
  selectedParadaId: string | null;
  fotoSelecionada: string | null;
  paradaToRemove: Parada | null;
  paradaToEdit: Parada | null;

  // Reorder state
  isReordering: boolean;
  hasReorderChanges: boolean;
  setHasReorderChanges: (value: boolean) => void;

  /**
   * Cancelar, reativar, trocar motorista ou remover parada em andamento. Os
   * `Dialog`s usam no `loading`; a trava de verdade é um ref interno.
   */
  acaoEmVoo: boolean;

  // Refs
  listaParadasRef: React.RefObject<FlatList<Parada> | null>;

  // Selection handlers
  handleMarkerPress: (paradaId: string) => void;
  handleMapPress: () => void;
  handleParadaPress: (paradaId: string) => void;
  handleImagePress: (url: string) => void;
  clearFotoSelecionada: () => void;

  // Route action handlers
  handleConfirmCancel: () => Promise<void>;
  handleConfirmReactivate: () => Promise<void>;
  handleChangeDriver: (
    newMotoristaId: string,
    newMotoristaNome: string,
  ) => Promise<void>;

  // Stop action handlers
  handleRemoveStopRequest: (parada: Parada) => void;
  handleConfirmRemoveStop: () => Promise<void>;
  clearParadaToRemove: () => void;
  handleEditStop: (parada: Parada) => void;
  handleEditStopSave: (
    routeRecalculationFailed?: boolean,
    vinculoNaoDesfeito?: boolean,
  ) => Promise<void>;
  clearParadaToEdit: () => void;
  handleAddStopSave: (routeRecalculationFailed?: boolean) => Promise<void>;
  handleReorderParadas: (newOrder: Parada[]) => Promise<void>;
}

/**
 * Hook for all action handlers in MapaRota page
 */
export function useMapaRotaHandlers({
  rotaId,
  rota,
  paradas,
  paradasReais,
  enderecoUnidade,
  loadRotaEParadas,
  showToast,
}: UseMapaRotaHandlersOptions): UseMapaRotaHandlersResult {
  const { userData } = useUser();

  // Selection state
  const [selectedParadaId, setSelectedParadaId] = useState<string | null>(null);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);
  const [paradaToRemove, setParadaToRemove] = useState<Parada | null>(null);
  const [paradaToEdit, setParadaToEdit] = useState<Parada | null>(null);

  // Reorder state
  const [isReordering, setIsReordering] = useState(false);
  const [hasReorderChanges, setHasReorderChanges] = useState(false);

  // Refs
  const listaParadasRef = useRef<FlatList<Parada> | null>(null);

  // Trava de toque duplo. O ref decide (é síncrono: o 2º clique no mesmo
  // quadro já o vê); o estado só serve para a tela mostrar o `loading`. Uma
  // trava só para as quatro ações: duas ações da rota ao mesmo tempo (ex.:
  // cancelar enquanto troca o motorista) também não devem correr juntas.
  const acaoEmVooRef = useRef(false);
  const [acaoEmVoo, setAcaoEmVoo] = useState(false);

  const comTrava = useCallback(async (acao: () => Promise<void>) => {
    if (acaoEmVooRef.current) return;
    acaoEmVooRef.current = true;
    setAcaoEmVoo(true);
    try {
      await acao();
    } finally {
      acaoEmVooRef.current = false;
      setAcaoEmVoo(false);
    }
  }, []);

  // Zero linhas no UPDATE da rota: avisa e traz o estado real. Devolve true
  // quando tratou o erro.
  const tratarRotaMudou = useCallback(
    async (error: unknown): Promise<boolean> => {
      if (!(error instanceof RotaMudouDeSituacao)) return false;
      logger.warn('[useMapaRotaHandlers] Rota mudou de situação', error);
      showToast(MENSAGEM_ROTA_MUDOU, 'info');
      await loadRotaEParadas();
      return true;
    },
    [loadRotaEParadas, showToast],
  );

  // Helper to get ID string
  const getIdString = useCallback(() => {
    return Array.isArray(rotaId) ? rotaId[0] : rotaId;
  }, [rotaId]);

  // Scroll to parada (FlatList: rola até o índice; onScrollToIndexFailed cobre itens não montados)
  const scrollToParada = useCallback(
    (paradaId: string) => {
      const index = paradasReais.findIndex((p) => p.id === paradaId);
      if (index >= 0 && listaParadasRef.current) {
        listaParadasRef.current.scrollToIndex({
          index,
          viewPosition: 0.3,
          animated: true,
        });
      }
    },
    [paradasReais],
  );

  // Selection handlers
  const handleMarkerPress = useCallback(
    (paradaId: string) => {
      setSelectedParadaId(paradaId);
      scrollToParada(paradaId);
    },
    [scrollToParada],
  );

  const handleMapPress = useCallback(() => {
    setSelectedParadaId(null);
  }, []);

  const handleParadaPress = useCallback((paradaId: string) => {
    setSelectedParadaId(paradaId);
  }, []);

  const handleImagePress = useCallback((url: string) => {
    setFotoSelecionada(url);
  }, []);

  const clearFotoSelecionada = useCallback(() => {
    setFotoSelecionada(null);
  }, []);

  // Route action handlers
  //
  // Cancelar e reativar passam pelas RPCs `cancelar_rota`/`reativar_rota`
  // (Migrations 70 e 71): o banco confere a situação viva da rota e se quem
  // chama é gestor ativo da loja, e grava rota + paradas (+ log, no reativar)
  // numa transação. Fora o sucesso, todo resultado recarrega a tela para
  // mostrar o estado real.
  const handleConfirmCancel = useCallback(async () => {
    const id = getIdString();
    if (!id) return;

    await comTrava(async () => {
      let resultado: ResultadoCancelarRota;
      try {
        resultado = await cancelarRota(id);
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao cancelar rota', error);
        showToast('Erro ao cancelar rota', 'error');
        return;
      }

      switch (resultado) {
        case 'cancelada':
          showToast('Rota cancelada com sucesso', 'success');
          break;
        case 'ja_cancelada':
          // Resposta perdida ou toque duplo: o 1º pedido já cancelou.
          showToast(MENSAGEM_ROTA_JA_CANCELADA, 'info');
          break;
        case 'situacao_mudou':
          showToast(MENSAGEM_ROTA_MUDOU, 'info');
          break;
        case 'sem_permissao':
          showToast(MENSAGEM_SEM_PERMISSAO_ROTA, 'error');
          break;
        default: {
          const naoTratado: never = resultado;
          throw new Error(`Resultado não tratado: ${String(naoTratado)}`);
        }
      }
      await loadRotaEParadas();
    });
  }, [comTrava, getIdString, loadRotaEParadas, showToast]);

  const handleConfirmReactivate = useCallback(async () => {
    const id = getIdString();
    if (!id) return;

    await comTrava(async () => {
      let resultado: ResultadoReativarRota;
      try {
        resultado = await reativarRota(id);
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao reativar rota', error);
        showToast('Erro ao reativar rota', 'error');
        return;
      }

      switch (resultado) {
        case 'reativada':
          showToast('Rota reativada com sucesso', 'success');
          break;
        case 'situacao_mudou':
          showToast(MENSAGEM_ROTA_MUDOU, 'info');
          break;
        case 'sem_permissao':
          showToast(MENSAGEM_SEM_PERMISSAO_ROTA, 'error');
          break;
        case 'motorista_indisponivel':
          showToast(MENSAGEM_MOTORISTA_INDISPONIVEL_REATIVAR, 'error');
          break;
        default: {
          const naoTratado: never = resultado;
          throw new Error(`Resultado não tratado: ${String(naoTratado)}`);
        }
      }
      await loadRotaEParadas();
    });
  }, [comTrava, getIdString, loadRotaEParadas, showToast]);

  const handleChangeDriver = useCallback(
    async (newMotoristaId: string, newMotoristaNome: string) => {
      const id = getIdString();
      if (!id || !rota) return;

      // O `ChangeDriverModal` tem o próprio `isLoading`, mas a trava fica aqui
      // para o handler ser seguro sozinho, venha a chamada de onde vier.
      await comTrava(async () => {
        try {
          // Só troca enquanto a rota está 'pendente': motorista que já iniciou
          // a rota no celular não pode perdê-la por uma tela aberta há tempos.
          const { data, error } = await supabase
            .from('rotas')
            .update({ motorista_id: newMotoristaId })
            .eq('id', id)
            .eq('status', 'pendente')
            .select('id');

          assertRotaAtualizada(data, error);

          await supabase.from('logs').insert({
            usuario_id: userData?.id,
            rota_id: id,
            evento: 'motorista_alterado',
            detalhes: {
              motorista_anterior_id: rota.motorista_id,
              motorista_anterior_nome: rota.motorista?.nome,
              motorista_novo_id: newMotoristaId,
              motorista_novo_nome: newMotoristaNome,
              alterado_por: userData?.nome,
            },
          });

          showToast('Motorista alterado com sucesso', 'success');
          await loadRotaEParadas();
        } catch (error) {
          if (await tratarRotaMudou(error)) return;
          logger.error(
            '[useMapaRotaHandlers] Erro ao alterar motorista',
            error,
          );
          showToast('Erro ao alterar motorista', 'error');
        }
      });
    },
    [
      comTrava,
      tratarRotaMudou,
      getIdString,
      rota,
      loadRotaEParadas,
      showToast,
      userData?.id,
      userData?.nome,
    ],
  );

  // Parada feita ou rota fechada não se edita nem se remove. A decisão vale
  // pelo estado VIVO (`paradas`, atualizado por realtime), não pelo objeto
  // que veio do clique: o gestor pode ter clicado num retrato velho.
  // Devolve true quando recusou (e já avisou).
  const recusarAlteracao = useCallback(
    (parada: Parada): boolean => {
      if (!rota) return false;
      const rotaFechada =
        rota.status !== 'pendente' && rota.status !== 'em_andamento';
      if (rotaFechada) {
        showToast('Esta rota não aceita mais alterações nas paradas.', 'error');
        return true;
      }
      const viva = paradas.find((p) => p.id === parada.id) ?? parada;
      if (podeAlterarParada(viva.status, rota.status)) return false;
      showToast(mensagemParadaNaoAlteravel(viva.status), 'error');
      void loadRotaEParadas();
      return true;
    },
    [rota, paradas, showToast, loadRotaEParadas],
  );

  // Diálogo/modal já aberto quando o motorista conclui a parada (ou a rota
  // fecha): fecha e explica, em vez de deixar o gestor confirmar no escuro.
  useEffect(() => {
    if (paradaToRemove && recusarAlteracao(paradaToRemove)) {
      setParadaToRemove(null);
    }
    if (paradaToEdit && recusarAlteracao(paradaToEdit)) {
      setParadaToEdit(null);
    }
  }, [paradaToRemove, paradaToEdit, recusarAlteracao]);

  // Stop action handlers
  const handleRemoveStopRequest = useCallback(
    (parada: Parada) => {
      if (recusarAlteracao(parada)) return;
      setParadaToRemove(parada);
    },
    [recusarAlteracao],
  );

  const clearParadaToRemove = useCallback(() => {
    setParadaToRemove(null);
  }, []);

  const handleConfirmRemoveStop = useCallback(async () => {
    const id = getIdString();
    if (!paradaToRemove || !id || !rota) return;

    await comTrava(async () => {
      // Conferência de última hora, pelo estado vivo: o efeito acima fecha o
      // diálogo, mas a confirmação pode ter chegado antes dele rodar.
      if (recusarAlteracao(paradaToRemove)) {
        setParadaToRemove(null);
        return;
      }

      try {
        if (!enderecoUnidade) {
          showToast('Erro: Coordenadas da unidade não encontradas', 'error');
          return;
        }

        const paradasRestantes = paradasReais
          .filter((p) => p.id !== paradaToRemove.id)
          .map((p, idx) => ({
            ...p,
            ordem: idx + 1,
          }));

        const result = await removerParadaERecalcular(
          paradaToRemove.id,
          id,
          paradasRestantes,
          enderecoUnidade,
          userData?.id,
        );

        if (result.success) {
          if (rota.motorista_id) {
            await notificarMotoristaRotaEditada({
              rotaId: id,
              motoristaId: rota.motorista_id,
              tipo: 'rota_parada_removida',
              titulo: '🗑️ Parada removida',
              mensagem: `Uma parada foi removida da sua rota: ${paradaToRemove.endereco?.substring(0, 50)}${(paradaToRemove.endereco?.length || 0) > 50 ? '...' : ''}`,
            });
          }

          showToast(
            result.routeRecalculationFailed
              ? 'Parada removida. O trajeto será recalculado ao carregar o mapa.'
              : 'Parada removida com sucesso',
            result.routeRecalculationFailed ? 'info' : 'success',
          );
          setParadaToRemove(null);
          await loadRotaEParadas();
        } else {
          showToast(result.error || 'Erro ao remover parada', 'error');
          // Se o banco recusou (parada finalizada, linha sumida), a tela estava
          // velha: traz o estado real.
          await loadRotaEParadas();
        }
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao remover parada', error);
        showToast('Erro ao remover parada', 'error');
      }
    });
  }, [
    comTrava,
    getIdString,
    paradaToRemove,
    rota,
    paradasReais,
    enderecoUnidade,
    loadRotaEParadas,
    recusarAlteracao,
    showToast,
    userData?.id,
  ]);

  const handleEditStop = useCallback(
    (parada: Parada) => {
      if (recusarAlteracao(parada)) return;
      setParadaToEdit(parada);
    },
    [recusarAlteracao],
  );

  const clearParadaToEdit = useCallback(() => {
    setParadaToEdit(null);
  }, []);

  const handleEditStopSave = useCallback(
    async (routeRecalculationFailed = false, vinculoNaoDesfeito = false) => {
      setParadaToEdit(null);
      if (vinculoNaoDesfeito) {
        // A edição valeu, mas as entregas dela ainda apontam para a parada que
        // deixou de ser retirada: o gestor precisa saber.
        showToast(
          'Parada atualizada, mas o vínculo das entregas dela não foi totalmente desfeito. Confira a ordem entre retirada e entregas.',
          'error',
          6000,
        );
      } else {
        showToast(
          routeRecalculationFailed
            ? 'Parada atualizada. O trajeto será recalculado ao carregar o mapa.'
            : 'Parada atualizada com sucesso',
          routeRecalculationFailed ? 'info' : 'success',
        );
      }
      await loadRotaEParadas();
    },
    [loadRotaEParadas, showToast],
  );

  const handleAddStopSave = useCallback(
    async (routeRecalculationFailed = false) => {
      showToast(
        routeRecalculationFailed
          ? 'Parada adicionada. O trajeto será recalculado ao carregar o mapa.'
          : 'Parada adicionada com sucesso',
        routeRecalculationFailed ? 'info' : 'success',
      );
      await loadRotaEParadas();
    },
    [loadRotaEParadas, showToast],
  );

  const handleReorderParadas = useCallback(
    async (newOrder: Parada[]) => {
      const id = getIdString();
      if (!id || !rota) {
        throw new Error('Rota não encontrada');
      }

      try {
        setIsReordering(true);

        if (!enderecoUnidade) {
          const errorMsg = 'Erro: Coordenadas da unidade não encontradas';
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }

        // 1. Update order in database
        const reorderResult = await reordenarParadas(
          newOrder.map((p, idx) => ({
            id: p.id,
            ordem: idx + 1,
            latitude: p.latitude,
            longitude: p.longitude,
            is_checkpoint: p.is_checkpoint,
          })),
        );

        if (!reorderResult.success) {
          const errorMsg = reorderResult.error || 'Erro ao reordenar paradas';
          showToast(errorMsg, 'error');
          throw new Error(errorMsg);
        }

        // 2. Recalculate route with new order
        let recalcWarning = false;
        try {
          const recalcResult = await recalcularRota(
            id,
            newOrder.map((p, idx) => ({
              id: p.id,
              ordem: idx + 1,
              latitude: p.latitude,
              longitude: p.longitude,
              is_checkpoint: p.is_checkpoint,
            })),
            enderecoUnidade,
          );

          if (!recalcResult.success) {
            logger.warn('[useMapaRotaHandlers] Recálculo falhou', {
              error: recalcResult.error,
            });
            recalcWarning = true;
          }
        } catch (recalcError) {
          logger.warn('[useMapaRotaHandlers] Erro no recálculo', recalcError);
          recalcWarning = true;
        }

        // 3. Reordenar à mão desfaz a otimização. Rota sem registro (NULL)
        // permanece sem registro — não inventamos o passado dela.
        const desfezOtimizacao = rota.otimizacao_estado === 'otimizada';
        // Escopo elevado até o log abaixo: o log precisa saber se o UPDATE
        // realmente aconteceu, não só se ele foi tentado — mesmo motivo (e
        // mesmo helper) de `assertUpdateAfetouLinhas` acima: RLS pode barrar
        // o UPDATE devolvendo 204 com ZERO linhas e `error: null`, e checar
        // só `error` não bastava.
        let otimizacaoMarcadaComoDesfeita = false;
        if (desfezOtimizacao) {
          try {
            const { data, error } = await supabase
              .from('rotas')
              .update({ otimizacao_estado: 'otimizada_alterada' })
              .eq('id', id)
              .select('id');

            assertUpdateAfetouLinhas(
              data,
              error,
              1,
              'UPDATE de otimizacao_estado não afetou nenhuma linha (RLS ou rota inexistente)',
            );
            otimizacaoMarcadaComoDesfeita = true;
          } catch (estadoError) {
            // `error`, não `warn`: warn é __DEV__-only (src/lib/logger.ts) e em
            // produção some. Este é o único ramo em que uma escrita de auditoria
            // falha em silêncio — a coluna fica 'otimizada' e o log registra
            // desfez_otimizacao: false, então sem isto a alteração manual não
            // deixa rastro nenhum.
            logger.error(
              '[useMapaRotaHandlers] Falha ao marcar otimização desfeita',
              estadoError,
            );
          }
        }

        // 4. Log action
        await supabase.from('logs').insert({
          usuario_id: userData?.id,
          rota_id: id,
          evento: 'paradas_reordenadas',
          detalhes: {
            nova_ordem: newOrder.map((p) => ({ id: p.id, ordem: p.ordem })),
            alterado_por: userData?.nome,
            // Reflete o que de fato foi gravado: `otimizacaoMarcadaComoDesfeita`
            // só fica `true` quando o UPDATE acima passou por
            // `assertUpdateAfetouLinhas` sem lançar — ou seja, quando ele
            // realmente afetou a linha. Se falhou (erro OU zero linhas por
            // RLS), `rotas.otimizacao_estado` continua 'otimizada' no banco —
            // o log não pode afirmar que a otimização foi desfeita.
            desfez_otimizacao: otimizacaoMarcadaComoDesfeita,
          },
        });

        // 5. Notify motorista
        if (rota.motorista_id) {
          await notificarMotoristaRotaEditada({
            rotaId: id,
            motoristaId: rota.motorista_id,
            tipo: 'rota_reordenada',
            titulo: '🔄 Rota reordenada',
            mensagem: `A ordem das paradas da sua rota foi alterada. Verifique a nova sequência.`,
          });
        }

        if (recalcWarning) {
          showToast(
            'Ordem salva! Distância/tempo podem estar desatualizados.',
            'info',
          );
        } else {
          showToast('Paradas reordenadas com sucesso', 'success');
        }

        await loadRotaEParadas();
      } catch (error) {
        logger.error('[useMapaRotaHandlers] Erro ao reordenar paradas', error);
        if (error instanceof Error && !error.message.startsWith('Erro')) {
          showToast('Erro ao reordenar paradas', 'error');
        }
        throw error;
      } finally {
        setIsReordering(false);
      }
    },
    [
      getIdString,
      rota,
      enderecoUnidade,
      loadRotaEParadas,
      showToast,
      userData?.id,
      userData?.nome,
    ],
  );

  return {
    // Selection state
    selectedParadaId,
    fotoSelecionada,
    paradaToRemove,
    paradaToEdit,

    // Reorder state
    isReordering,
    hasReorderChanges,
    setHasReorderChanges,

    acaoEmVoo,

    // Refs
    listaParadasRef,

    // Selection handlers
    handleMarkerPress,
    handleMapPress,
    handleParadaPress,
    handleImagePress,
    clearFotoSelecionada,

    // Route action handlers
    handleConfirmCancel,
    handleConfirmReactivate,
    handleChangeDriver,

    // Stop action handlers
    handleRemoveStopRequest,
    handleConfirmRemoveStop,
    clearParadaToRemove,
    handleEditStop,
    handleEditStopSave,
    clearParadaToEdit,
    handleAddStopSave,
    handleReorderParadas,
  };
}
