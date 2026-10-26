/**
 * Localização de UM endereço da importação em lote da nova rota.
 *
 * O lote antigo geocodificava pelo Photon sem viés e aceitava o 1º resultado
 * às cegas: "Rua Exemplo, 100" sem cidade virava a homônima de outro estado.
 * Aqui o caminho principal é o mesmo do cadastro manual — o roteador
 * (`geocodingService`: Google Places com viés pela sede; CEP pelo ViaCEP) —
 * e o Photon fica só como fallback quando o roteador não devolve nada.
 * O resultado não vira parada: volta para o gestor conferir (texto colado →
 * endereço encontrado, distância da sede e fonte).
 */
import { distanceInMeters } from '@/hooks/useNovaEntrega.helpers';
import { geocodingService } from '@/lib/geocoding';
import { logger } from '@/lib/logger';
import { photonService } from '@/lib/photon';
import type { Coordenadas, EnderecoGeocodificado } from '@/types/endereco';

/** Acima desta distância da sede a linha ganha aviso na conferência. */
export const DISTANCIA_CONFERIR_LOTE_KM = 30;

export type FonteEnderecoLote = 'google' | 'viacep' | 'photon';

export interface EnderecoLoteResolvido {
  enderecoEncontrado: string;
  latitude: number;
  longitude: number;
  fonte: FonteEnderecoLote;
  distanciaSedeKm: number | null;
}

function montarEnderecoPhoton(resultado: EnderecoGeocodificado): string {
  if (resultado.formatted_address?.trim()) return resultado.formatted_address;
  return [
    resultado.logradouro,
    resultado.numero,
    resultado.bairro,
    resultado.cidade,
    resultado.estado,
  ]
    .filter((parte) => parte?.trim())
    .join(', ');
}

function distanciaDaSedeKm(
  coordenadas: Coordenadas,
  sede: Coordenadas | null,
): number | null {
  if (!sede) return null;
  return distanceInMeters(coordenadas, sede) / 1000;
}

async function viaRoteador(
  endereco: string,
  sede: Coordenadas | null,
): Promise<Omit<EnderecoLoteResolvido, 'distanciaSedeKm'> | null> {
  try {
    const sugestao = await geocodingService.autocompleteWithCoordinates(
      endereco,
      sede ?? undefined,
    );
    if (!sugestao?.coordinates) return null;
    return {
      enderecoEncontrado: sugestao.description,
      latitude: sugestao.coordinates.latitude,
      longitude: sugestao.coordinates.longitude,
      fonte: sugestao.source,
    };
  } catch (error) {
    // Places fora do ar não pode derrubar o lote: o Photon ainda tenta.
    logger.warn(
      '[localizarEnderecoLote] Roteador falhou; tentando Photon',
      error,
    );
    return null;
  }
}

async function viaPhoton(
  endereco: string,
): Promise<Omit<EnderecoLoteResolvido, 'distanciaSedeKm'> | null> {
  try {
    const resultado = await photonService.geocodeAddress(endereco);
    if (!resultado) return null;
    return {
      enderecoEncontrado: montarEnderecoPhoton(resultado) || endereco,
      latitude: resultado.coordenadas.latitude,
      longitude: resultado.coordenadas.longitude,
      fonte: 'photon',
    };
  } catch (error) {
    logger.warn('[localizarEnderecoLote] Photon falhou', error);
    return null;
  }
}

export async function localizarEnderecoLote(
  endereco: string,
  sede: Coordenadas | null,
): Promise<EnderecoLoteResolvido | null> {
  const encontrado =
    (await viaRoteador(endereco, sede)) ?? (await viaPhoton(endereco));
  if (!encontrado) return null;

  return {
    ...encontrado,
    distanciaSedeKm: distanciaDaSedeKm(encontrado, sede),
  };
}
