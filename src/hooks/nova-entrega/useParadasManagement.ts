import { useCallback, useMemo, useState } from 'react';

import type {
  Parada,
  ParadaFormData,
  ParadaFormDataWithCoords,
  ParadasStatus,
  RotaOtimizadaState,
} from '@/components/gestor/nova-entrega/types';
import { logger } from '@/lib/logger';
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

export interface BulkParadaInput extends ParadaFormData {
  latitude?: number;
  longitude?: number;
}

export interface BulkImportResult {
  adicionadas: number;
  ignoradas: number;
  erros: string[];
}

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
  importParadas: (items: BulkParadaInput[]) => Promise<BulkImportResult>;
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

export function useParadasManagement({
  paradas,
  setParadas,
  rotaOtimizada,
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

  const importParadas = useCallback(
    async (items: BulkParadaInput[]): Promise<BulkImportResult> => {
      setIsLoading(true);
      const erros: string[] = [];
      const novas: Parada[] = [];
      let ignoradas = 0;

      try {
        for (const [index, item] of items.entries()) {
          if (paradas.length + novas.length >= MAX_ROUTE_STOPS) {
            erros.push(`Linha ${index + 1}: limite da rota atingido.`);
            ignoradas += items.length - index;
            break;
          }

          if (encontrarParadaDuplicada([...paradas, ...novas], item)) {
            ignoradas += 1;
            erros.push(`Linha ${index + 1}: endereço ou telefone duplicado.`);
            continue;
          }

          let latitude = item.latitude;
          let longitude = item.longitude;
          if (latitude == null || longitude == null) {
            const geocoded = await photonService.geocodeAddress(item.endereco);
            if (!geocoded) {
              ignoradas += 1;
              erros.push(`Linha ${index + 1}: endereço não localizado.`);
              continue;
            }
            latitude = geocoded.coordenadas.latitude;
            longitude = geocoded.coordenadas.longitude;
          }

          novas.push({
            ...item,
            id: generateUniqueId(),
            latitude,
            longitude,
            ordem: paradas.length + novas.length + 1,
          });
        }

        if (novas.length > 0) {
          setParadas((current) => reindex([...current, ...novas]));
          invalidateOptimization();
          showToast(
            `${novas.length} parada(s) importada(s).${ignoradas ? ` ${ignoradas} ignorada(s).` : ''}`,
            ignoradas ? 'info' : 'success',
            5000,
          );
        }

        return { adicionadas: novas.length, ignoradas, erros };
      } finally {
        setIsLoading(false);
      }
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
    importParadas,
    removeParada,
    moveParadaUp,
    moveParadaDown,
    reorderParadas,
    clearParadas,
  };
}
