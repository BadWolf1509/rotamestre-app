/**
 * Hook para gerenciar o endereço da unidade ativa
 * Carrega coordenadas do banco ou faz geocoding se necessário
 */

import { useState, useCallback, useEffect } from 'react';

import type { EnderecoUnidade } from '@/components/gestor/nova-entrega/types';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { googleMapsService } from '@/lib/google';
import { logger } from '@/lib/logger';

export interface UseEnderecoUnidadeReturn {
  enderecoUnidade: EnderecoUnidade | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

export function useEnderecoUnidade(
  onError?: (message: string) => void
): UseEnderecoUnidadeReturn {
  const { unidadeAtivaData } = useUnidadeAtiva();
  const [enderecoUnidade, setEnderecoUnidade] = useState<EnderecoUnidade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnderecoUnidade = useCallback(async () => {
    if (!unidadeAtivaData) {
      logger.warn('[useEnderecoUnidade] Usuário sem unidade vinculada');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const parseCoordinate = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const latitudeFromDb = parseCoordinate(unidadeAtivaData.sede_latitude);
    const longitudeFromDb = parseCoordinate(unidadeAtivaData.sede_longitude);
    const enderecoBase = unidadeAtivaData.sede_endereco || unidadeAtivaData.endereco;

    const enderecoCompleto = [
      enderecoBase,
      unidadeAtivaData.cidade,
      unidadeAtivaData.uf,
      unidadeAtivaData.cep,
    ]
      .filter((parte) => typeof parte === 'string' && parte.trim().length > 0)
      .join(', ');

    // Se já tem coordenadas no banco, usar diretamente
    if (latitudeFromDb != null && longitudeFromDb != null) {
      setEnderecoUnidade({
        latitude: latitudeFromDb,
        longitude: longitudeFromDb,
        endereco: enderecoCompleto || enderecoBase || 'Sede da unidade',
      });
      setIsLoading(false);
      return;
    }

    // Sem endereço completo, não pode geocodificar
    if (!enderecoCompleto) {
      logger.warn('[useEnderecoUnidade] Unidade sem endereço completo cadastrado');
      onError?.('Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.');
      setIsLoading(false);
      return;
    }

    // Geocodificar o endereço
    try {
      const result = await googleMapsService.geocodeAddress(enderecoCompleto);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: result.formatted_address || enderecoCompleto,
        });
      } else {
        logger.error('[useEnderecoUnidade] Não foi possível geocodificar o endereço da unidade');
        onError?.('Endereço da unidade não encontrado. Verifique o cadastro da unidade.');
      }
    } catch (error) {
      logger.error('[useEnderecoUnidade] Erro ao geocodificar endereço da unidade', error);
    } finally {
      setIsLoading(false);
    }
  }, [onError, unidadeAtivaData]);

  useEffect(() => {
    if (unidadeAtivaData) {
      loadEnderecoUnidade();
    }
  }, [loadEnderecoUnidade, unidadeAtivaData]);

  return {
    enderecoUnidade,
    isLoading,
    reload: loadEnderecoUnidade,
  };
}
