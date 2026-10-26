import { useCallback, useMemo, useState } from 'react';

import type {
  EnderecoUnidade,
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  ParadasStatus,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { logger } from '@/lib/logger';
import {
  localizarEnderecoLote,
  type EnderecoLoteResolvido,
} from '@/lib/nova-entrega/localizarEnderecoLote';
import { photonService } from '@/lib/photon';
import {
  MAX_ROUTE_STOPS,
  WAYPOINTS_RECOMENDADO,
} from '@/lib/routeOptimization';

import {
  encontrarParadaDuplicada,
  generateUniqueId,
  validarOrdemDependencias,
} from '../useNovaEntrega.helpers';

import type { Dispatch, SetStateAction } from 'react';

/**
 * Uma linha do lote colado. `linha` é o número REAL da linha no texto (conta
 * cabeçalho e linhas em branco): é ele que aparece em "Linha N: …", para o
 * gestor achar a linha no que colou — o índice no array não serve para isso.
 */
export interface BulkParadaInput extends ParadaFormData {
  linha: number;
}

/** Linha localizada, à espera da conferência do gestor. */
export interface EnderecoLocalizado extends EnderecoLoteResolvido {
  linha: number;
  item: BulkParadaInput;
}

export interface LocalizarLoteResult {
  localizados: EnderecoLocalizado[];
  erros: string[];
}

export interface BulkImportResult {
  adicionadas: number;
  ignoradas: number;
  erros: string[];
  /** Linhas coladas que viraram parada — o resto volta ao campo do importador. */
  linhasAdicionadas: number[];
}

export interface LocalizarLoteOpcoes {
  /**
   * Andamento da fase 1: `atual` é a linha em curso (1-based) de `total`.
   * Localizar em série leva dezenas de segundos para 50 linhas.
   */
  onProgresso?: (atual: number, total: number) => void;
}

export interface ImportParadasOpcoes {
  /**
   * Linhas do lote que nem chegaram à fase 2 (não localizadas ou removidas na
   * conferência). Entram na conta do toast, que não pode dizer só "sucesso".
   */
  foraDoLote?: number;
}

export type LocalizarLoteFn = (
  items: BulkParadaInput[],
  opcoes?: LocalizarLoteOpcoes,
) => Promise<LocalizarLoteResult>;

export type ImportParadasFn = (
  confirmados: EnderecoLocalizado[],
  opcoes?: ImportParadasOpcoes,
) => BulkImportResult;

export interface UseParadasManagementReturn {
  retiradasDisponiveis: Parada[];
  paradasStatus: ParadasStatus;
  isLoading: boolean;
  onAddParada: (
    data: ParadaFormData,
    vinculoId?: string,
    editingId?: string,
    allowDuplicate?: boolean,
  ) => Promise<boolean>;
  /** Localiza as linhas (uma por vez) sem criar paradas. */
  localizarLote: LocalizarLoteFn;
  /** Cria as paradas conferidas, com a coordenada confirmada. */
  importParadas: ImportParadasFn;
  removeParada: (index: number) => void;
  moveParadaUp: (index: number) => void;
  moveParadaDown: (index: number) => void;
  reorderParadas: (data: Parada[]) => void;
  clearParadas: (onUndo?: () => void) => void;
}

export interface UseParadasManagementOptions {
  paradas: Parada[];
  setParadas: Dispatch<SetStateAction<Parada[]>>;
  rotaOtimizada: RotaOtimizadaState | null;
  /** Sede da loja: viés da busca do lote e base da distância conferida. */
  enderecoUnidade: EnderecoUnidade | null;
  onOrdemManualChange: (manual: boolean) => void;
  onRotaOtimizadaReset: () => void;
  onDistanciaManualRealReset: () => void;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'info',
    duration?: number,
    action?: { label: string; onPress: () => void },
  ) => void;
  onFormReset: () => void;
}

function reindex(paradas: Parada[]): Parada[] {
  return paradas.map((parada, index) => ({ ...parada, ordem: index + 1 }));
}

type CandidataLote = Pick<Parada, 'id' | 'endereco' | 'telefone' | 'tipo'>;

/**
 * Regra única de recusa de uma linha do lote, usada nas duas fases (localizar
 * e importar): `lista` é tudo o que já ocupa a rota — paradas existentes mais
 * as linhas do lote já aceitas antes desta. Devolve a mensagem ou `null`.
 * O limite vem antes da duplicata: rota cheia recusa qualquer linha.
 */
export function motivoRecusaLote(
  lista: readonly CandidataLote[],
  item: BulkParadaInput,
): string | null {
  if (lista.length >= MAX_ROUTE_STOPS) {
    return `Linha ${item.linha}: limite da rota atingido.`;
  }
  if (encontrarParadaDuplicada([...lista], item)) {
    return `Linha ${item.linha}: ${item.tipo} duplicada (mesmo endereço ou telefone).`;
  }
  return null;
}

function textoLinhasFora(quantidade: number): string {
  return quantidade === 1
    ? '1 linha não entrou.'
    : `${quantidade} linhas não entraram.`;
}

/** Forma mínima para comparar duplicata entre linhas que ainda não são parada. */
function comoCandidata(item: BulkParadaInput) {
  return {
    id: `lote-linha-${item.linha}`,
    tipo: item.tipo,
    endereco: item.endereco,
    telefone: item.telefone,
  };
}

export function useParadasManagement({
  paradas,
  setParadas,
  rotaOtimizada,
  enderecoUnidade,
  onOrdemManualChange,
  onRotaOtimizadaReset,
  onDistanciaManualRealReset,
  showToast,
  onFormReset,
}: UseParadasManagementOptions): UseParadasManagementReturn {
  const [isLoading, setIsLoading] = useState(false);

  const retiradasDisponiveis = useMemo(
    () => paradas.filter((parada) => parada.tipo === 'retirada'),
    [paradas],
  );

  const paradasStatus = useMemo((): ParadasStatus => {
    const count = paradas.length;
    if (count > MAX_ROUTE_STOPS) {
      return {
        texto: `${count} paradas (excede limite de ${MAX_ROUTE_STOPS})`,
        cor: 'error',
        icone: 'warning',
      };
    }
    if (count > WAYPOINTS_RECOMENDADO) {
      return {
        texto: `${count}/${MAX_ROUTE_STOPS} paradas (próximo do limite)`,
        cor: 'warning',
        icone: 'alert-circle',
      };
    }
    if (count > 0) {
      return {
        texto: `${count} parada(s) na lista`,
        cor: 'default',
        icone: null,
      };
    }
    return {
      texto: 'Nenhuma parada adicionada',
      cor: 'default',
      icone: null,
    };
  }, [paradas.length]);

  const invalidateOptimization = useCallback(() => {
    onRotaOtimizadaReset();
    onOrdemManualChange(false);
    onDistanciaManualRealReset();
  }, [onDistanciaManualRealReset, onOrdemManualChange, onRotaOtimizadaReset]);

  const onAddParada = useCallback(
    async (
      paradaData: ParadaFormData,
      vinculoId?: string,
      editingId?: string,
      allowDuplicate = false,
    ): Promise<boolean> => {
      if (!editingId && paradas.length >= MAX_ROUTE_STOPS) {
        showToast(
          `O limite de ${MAX_ROUTE_STOPS} paradas foi atingido.`,
          'error',
          5000,
        );
        return false;
      }

      if (
        !allowDuplicate &&
        encontrarParadaDuplicada(paradas, paradaData, editingId)
      ) {
        return false;
      }

      setIsLoading(true);
      try {
        const extendedData = { ...paradaData } as ParadaFormDataWithCoords;
        if (extendedData.latitude == null || extendedData.longitude == null) {
          const result = await photonService.geocodeAddress(
            paradaData.endereco,
          );
          if (!result) {
            showToast(
              'Não foi possível localizar o endereço. Selecione uma sugestão válida.',
              'error',
              5000,
            );
            return false;
          }
          extendedData.latitude = result.coordenadas.latitude;
          extendedData.longitude = result.coordenadas.longitude;
        }

        if (editingId) {
          const updatedStops = paradas.map((parada) =>
            parada.id === editingId
              ? {
                  ...parada,
                  ...extendedData,
                  vinculo_parada_id: vinculoId,
                }
              : parada,
          );
          const dependencyErrors = validarOrdemDependencias(updatedStops);
          if (dependencyErrors.length > 0) {
            showToast(dependencyErrors[0], 'error', 5000);
            return false;
          }
          setParadas(updatedStops);
          showToast('Parada atualizada.', 'success');
        } else {
          const novaParada: Parada = {
            ...extendedData,
            id: generateUniqueId(),
            latitude: extendedData.latitude,
            longitude: extendedData.longitude,
            ordem: paradas.length + 1,
            vinculo_parada_id: vinculoId,
          };
          setParadas((current) => [...current, novaParada]);
          showToast(
            vinculoId
              ? 'Entrega vinculada. A retirada será executada primeiro.'
              : 'Parada adicionada à lista.',
            'success',
          );
        }

        onFormReset();
        invalidateOptimization();
        return true;
      } catch (error) {
        logger.error('[useParadasManagement] Erro ao salvar parada', error);
        showToast('Não foi possível salvar a parada.', 'error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidateOptimization, onFormReset, paradas, setParadas, showToast],
  );

  const sedeLatitude = enderecoUnidade?.latitude;
  const sedeLongitude = enderecoUnidade?.longitude;

  /**
   * Fase 1 do lote: localiza cada linha e devolve para conferência, sem tocar
   * na lista. Duplicada e excesso do limite viram erro ANTES de consultar o
   * endereço, para não gastar Places com linha que não vai entrar.
   *
   * Em série, de propósito: cada linha custa 1 autocomplete + 1 details do
   * Places. Um lote limitado (3 em paralelo) faria 50 linhas em ~1/3 do tempo,
   * mas a duplicata dentro do lote depende de quais linhas anteriores foram
   * aceitas — em paralelo, duas linhas iguais passariam juntas. A ordem dos
   * erros também segue a do texto colado.
   */
  const localizarLote = useCallback(
    async (
      items: BulkParadaInput[],
      opcoes?: LocalizarLoteOpcoes,
    ): Promise<LocalizarLoteResult> => {
      const sede =
        sedeLatitude != null && sedeLongitude != null
          ? { latitude: sedeLatitude, longitude: sedeLongitude }
          : null;
      const localizados: EnderecoLocalizado[] = [];
      const erros: string[] = [];

      setIsLoading(true);
      try {
        for (const [indice, item] of items.entries()) {
          opcoes?.onProgresso?.(indice + 1, items.length);

          const recusa = motivoRecusaLote(
            [
              ...paradas,
              ...localizados.map((localizado) =>
                comoCandidata(localizado.item),
              ),
            ],
            item,
          );
          if (recusa) {
            erros.push(recusa);
            continue;
          }

          let resolvido: EnderecoLoteResolvido | null = null;
          try {
            resolvido = await localizarEnderecoLote(item.endereco, sede);
          } catch (error) {
            // A lib já se protege; isto é rede de segurança para uma linha
            // não derrubar o lote inteiro.
            logger.warn(
              '[useParadasManagement] Falha ao localizar linha do lote',
              error,
            );
          }

          if (!resolvido) {
            erros.push(`Linha ${item.linha}: endereço não localizado.`);
            continue;
          }

          localizados.push({ ...resolvido, linha: item.linha, item });
        }

        return { localizados, erros };
      } finally {
        setIsLoading(false);
      }
    },
    [paradas, sedeLatitude, sedeLongitude],
  );

  /**
   * Fase 2 do lote: cria as paradas que o gestor conferiu, com a coordenada
   * confirmada — sem geocodificar de novo. Duplicata e limite são conferidos
   * outra vez porque a lista pode ter mudado durante a conferência.
   *
   * O `endereco` da parada continua sendo o texto colado (não o encontrado):
   * ele carrega complemento ("apto 302", "fundos") que a sugestão do Places
   * descarta, e é o que o motorista lê.
   */
  const importParadas = useCallback(
    (
      confirmados: EnderecoLocalizado[],
      opcoes?: ImportParadasOpcoes,
    ): BulkImportResult => {
      const erros: string[] = [];
      const novas: Parada[] = [];
      const linhasAdicionadas: number[] = [];
      let ignoradas = 0;

      for (const confirmado of confirmados) {
        const { linha: _linha, ...dados } = confirmado.item;

        const recusa = motivoRecusaLote(
          [...paradas, ...novas],
          confirmado.item,
        );
        if (recusa) {
          ignoradas += 1;
          erros.push(recusa);
          continue;
        }

        linhasAdicionadas.push(confirmado.linha);
        novas.push({
          ...dados,
          id: generateUniqueId(),
          latitude: confirmado.latitude,
          longitude: confirmado.longitude,
          ordem: paradas.length + novas.length + 1,
        });
      }

      if (novas.length > 0) {
        const fora = ignoradas + (opcoes?.foraDoLote ?? 0);
        setParadas((current) => reindex([...current, ...novas]));
        invalidateOptimization();
        showToast(
          `${novas.length} parada(s) importada(s).${fora ? ` ${textoLinhasFora(fora)}` : ''}`,
          fora ? 'info' : 'success',
          5000,
        );
      }

      return { adicionadas: novas.length, ignoradas, erros, linhasAdicionadas };
    },
    [invalidateOptimization, paradas, setParadas, showToast],
  );

  const removeParada = useCallback(
    (index: number) => {
      const snapshot = [...paradas];
      const removida = paradas[index];
      if (!removida) return;

      let next = paradas.filter((_, currentIndex) => currentIndex !== index);
      const dependentes = next.filter(
        (parada) => parada.vinculo_parada_id === removida.id,
      ).length;
      if (dependentes > 0) {
        next = next.map((parada) =>
          parada.vinculo_parada_id === removida.id
            ? { ...parada, vinculo_parada_id: undefined }
            : parada,
        );
      }

      setParadas(reindex(next));
      invalidateOptimization();
      showToast(
        dependentes
          ? `Parada removida e ${dependentes} vínculo(s) desfeito(s).`
          : 'Parada removida.',
        'info',
        7000,
        {
          label: 'Desfazer',
          onPress: () =>
            setParadas((current) => {
              if (current.some((parada) => parada.id === removida.id)) {
                return current;
              }

              const restored = [...current];
              restored.splice(Math.min(index, restored.length), 0, removida);
              return reindex(
                restored.map((parada) => {
                  const original = snapshot.find(
                    (item) => item.id === parada.id,
                  );
                  return original?.vinculo_parada_id === removida.id
                    ? { ...parada, vinculo_parada_id: removida.id }
                    : parada;
                }),
              );
            }),
        },
      );
    },
    [invalidateOptimization, paradas, setParadas, showToast],
  );

  const applyOrder = useCallback(
    (candidate: Parada[]) => {
      const reordered = reindex(candidate);
      const dependencyErrors = validarOrdemDependencias(reordered);
      if (dependencyErrors.length > 0) {
        showToast(dependencyErrors[0], 'error', 5000);
        return;
      }

      setParadas(reordered);
      if (rotaOtimizada) onOrdemManualChange(true);
      onDistanciaManualRealReset();
    },
    [
      onDistanciaManualRealReset,
      onOrdemManualChange,
      rotaOtimizada,
      setParadas,
      showToast,
    ],
  );

  const moveParadaUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const candidate = [...paradas];
      [candidate[index - 1], candidate[index]] = [
        candidate[index],
        candidate[index - 1],
      ];
      applyOrder(candidate);
    },
    [applyOrder, paradas],
  );

  const moveParadaDown = useCallback(
    (index: number) => {
      if (index >= paradas.length - 1) return;
      const candidate = [...paradas];
      [candidate[index], candidate[index + 1]] = [
        candidate[index + 1],
        candidate[index],
      ];
      applyOrder(candidate);
    },
    [applyOrder, paradas],
  );

  const reorderParadas = useCallback(
    (data: Parada[]) => applyOrder(data),
    [applyOrder],
  );

  const clearParadas = useCallback(
    (onUndo?: () => void) => {
      const snapshot = [...paradas];
      setParadas([]);
      invalidateOptimization();
      showToast('Rascunho limpo.', 'info', 7000, {
        label: 'Desfazer',
        onPress: () => {
          setParadas((current) => {
            const merged = new Map(
              snapshot.map((parada) => [parada.id, parada]),
            );
            current.forEach((parada) => merged.set(parada.id, parada));
            return reindex([...merged.values()]);
          });
          onUndo?.();
        },
      });
    },
    [invalidateOptimization, paradas, setParadas, showToast],
  );

  return {
    retiradasDisponiveis,
    paradasStatus,
    isLoading,
    onAddParada,
    localizarLote,
    importParadas,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    reorderParadas,
    clearParadas,
  };
}
