/**
 * Hook para gerenciar o endereço da unidade ativa
 * Carrega coordenadas do banco ou faz geocoding se necessário
 */

import { useState, useCallback, useEffect } from 'react';

import type { EnderecoUnidade } from '@/components/gestor/nova-entrega/types';
import { normalizeComparable } from '@/hooks/useNovaEntrega.helpers';
import { useUnidadeAtiva } from '@/hooks/useUnidadeAtiva';
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon';

export interface UseEnderecoUnidadeReturn {
  enderecoUnidade: EnderecoUnidade | null;
  isLoading: boolean;
  reload: () => Promise<void>;
}

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Junta as partes do endereço sem repetir o que a base já traz.
 *
 * `sede_endereco` costuma vir do Google Places já completo ("… João Pessoa -
 * PB"), enquanto cidade, UF e CEP vêm do cadastro. Concatenar sem olhar produzia
 * "… João Pessoa - PB, João Pessoa, PB" na tela de Nova Rota, no banner da rota
 * otimizada e no texto mandado ao geocoding. Simplesmente parar de concatenar
 * não serve: para um endereço cru ("Rua das Flores, 50") é a concatenação que
 * impede o geocoding de errar de cidade.
 *
 * A comparação exige fronteira de não-alfanumérico dos dois lados — sem isso a
 * UF "PA" casaria dentro de "Parnamirim" e sumiria do endereço.
 */
function juntarSemRepetir(partes: (string | null | undefined)[]): string {
  let resultado = '';
  let normalizado = '';

  for (const parte of partes) {
    if (typeof parte !== 'string') continue;
    const limpa = parte.trim();
    if (!limpa) continue;

    const alvo = escaparRegex(normalizeComparable(limpa));
    const jaPresente = new RegExp(`(^|[^a-z0-9])${alvo}([^a-z0-9]|$)`).test(
      normalizado,
    );
    if (jaPresente) continue;

    resultado = resultado ? `${resultado}, ${limpa}` : limpa;
    normalizado = normalizeComparable(resultado);
  }

  return resultado;
}

export function useEnderecoUnidade(
  onError?: (message: string) => void,
): UseEnderecoUnidadeReturn {
  const { unidadeAtivaData } = useUnidadeAtiva();
  const [enderecoUnidade, setEnderecoUnidade] =
    useState<EnderecoUnidade | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEnderecoUnidade = useCallback(async () => {
    setEnderecoUnidade(null);
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
    const enderecoBase =
      unidadeAtivaData.sede_endereco || unidadeAtivaData.endereco;

    const enderecoCompleto = juntarSemRepetir([
      enderecoBase,
      unidadeAtivaData.cidade,
      unidadeAtivaData.uf,
      unidadeAtivaData.cep,
    ]);

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
      logger.warn(
        '[useEnderecoUnidade] Unidade sem endereço completo cadastrado',
      );
      onError?.(
        'Endereço da unidade não encontrado. Complete o cadastro antes de gerar rotas.',
      );
      setIsLoading(false);
      return;
    }

    // Geocodificar o endereço (Photon - gratuito!)
    try {
      const result = await photonService.geocodeAddress(enderecoCompleto);
      if (result?.coordenadas) {
        setEnderecoUnidade({
          latitude: result.coordenadas.latitude,
          longitude: result.coordenadas.longitude,
          endereco: result.formatted_address || enderecoCompleto,
        });
      } else {
        logger.error(
          '[useEnderecoUnidade] Não foi possível geocodificar o endereço da unidade',
        );
        onError?.(
          'Endereço da unidade não encontrado. Verifique o cadastro da unidade.',
        );
      }
    } catch (error) {
      logger.error(
        '[useEnderecoUnidade] Erro ao geocodificar endereço da unidade',
        error,
      );
    } finally {
      setIsLoading(false);
    }
  }, [onError, unidadeAtivaData]);

  useEffect(() => {
    loadEnderecoUnidade();
  }, [loadEnderecoUnidade, unidadeAtivaData]);

  return {
    enderecoUnidade,
    isLoading,
    reload: loadEnderecoUnidade,
  };
}
