/**
 * Hook para carregar e gerenciar o endereço da unidade ativa
 * Inclui geocodificação automática se coordenadas não estiverem no banco
 */

import { useState, useEffect, useCallback } from 'react';


import { useToast } from '@/hooks/useToast';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon';
import type { UnidadeComSede } from '@/types/usuario';

export interface EnderecoUnidade {
  latitude: number;
  longitude: number;
  endereco: string;
}

export interface UseEnderecoUnidadeReturn {
  enderecoUnidade: EnderecoUnidade | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

export function useEnderecoUnidade(): UseEnderecoUnidadeReturn {
  const { unidadeAtivaData } = useUnidadeAtiva();
  const { showToast } = useToast();

  const [enderecoUnidade, setEnderecoUnidade] = useState<EnderecoUnidade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnderecoUnidade = useCallback(async (unidade: UnidadeComSede | null) => {
    if (!unidade) {
      logger.warn('[useEnderecoUnidade] Usuário sem unidade vinculada');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const parseCoordinate = (value: unknown): number | null => {
        if (value === null || value === undefined) return null;
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      };

      const latitudeFromDb = parseCoordinate(unidade.sede_latitude);
      const longitudeFromDb = parseCoordinate(unidade.sede_longitude);
      const enderecoBase = unidade.sede_endereco || unidade.endereco;

      const enderecoCompleto = [
        enderecoBase,
        unidade.cidade,
        unidade.uf,
        unidade.cep,
      ]
        .filter((parte) => typeof parte === 'string' && parte.trim().length > 0)
        .join(', ');

      // Se já tem coordenadas no banco, usa direto
      if (latitudeFromDb != null && longitudeFromDb != null) {
        setEnderecoUnidade({
          latitude: latitudeFromDb,
          longitude: longitudeFromDb,
          endereco: enderecoCompleto || enderecoBase || 'Sede da unidade',
        });
        return;
      }

      // Sem endereço para geocodificar
      if (!enderecoCompleto) {
        logger.warn('[useEnderecoUnidade] Unidade sem endereço completo cadastrado');
        showToast('Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.', 'error');
        return;
      }

      // Geocodificar endereço (Photon - gratuito!)
      const result = await photonService.geocodeAddress(enderecoCompleto);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: result.formatted_address || enderecoCompleto,
        });
      } else {
        logger.error('[useEnderecoUnidade] Não foi possível geocodificar o endereço da unidade');
        showToast('Endereço da unidade não encontrado. Verifique o cadastro da unidade.', 'error');
      }
    } catch (error) {
      logger.error('[useEnderecoUnidade] Erro ao geocodificar endereço da unidade', error);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (unidadeAtivaData) {
      loadEnderecoUnidade(unidadeAtivaData);
    }
    // Only reload when id or updated_at changes, not on every object reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEnderecoUnidade, unidadeAtivaData?.id, unidadeAtivaData?.updated_at]);

  return {
    enderecoUnidade,
    isLoading,
    reload: () => loadEnderecoUnidade(unidadeAtivaData),
  };
}
