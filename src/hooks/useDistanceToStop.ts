import { useEffect, useState, useRef } from 'react';

import { logger } from '@/lib/logger';
import { getDistance, estimateRouteDistance } from '@/lib/osrm';
import { calculateHaversineDistance } from '@/lib/osrm/fallback';

interface DistanceInfo {
  distanceMeters: number;
  distanceKm: string;
  durationSeconds: number;
  durationText: string;
  isLoading: boolean;
  error: string | null;
  /**
   * `true` quando o número veio do fallback Haversine (linha reta × 1.3, ETA a
   * 30 km/h fixos) em vez de um percurso viário do OSRM. Acontece quando o
   * serviço falha ou quando a coordenada está fora da área do extrato.
   */
  isEstimated: boolean;
}

/** Intervalo padrão entre consultas ao OSRM (2 min). */
const INTERVALO_PADRAO_MS = 120000;
/** Menor espaço entre duas consultas disparadas por movimento. */
const INTERVALO_MINIMO_MOVIMENTO_MS = 30000;
/**
 * Quanto a posição precisa andar desde a última consulta para recalcular antes
 * do intervalo. 500 m: a 40 km/h são ~45 s, e o número na tela ("1,2 km") só
 * fica velho por esse tanto. 100 m refaria a consulta a cada ~9 s no carro,
 * que é o excesso que este limiar existe para evitar.
 */
const LIMIAR_MOVIMENTO_METROS = 500;

const DISTANCIA_VAZIA: DistanceInfo = {
  distanceMeters: 0,
  distanceKm: '--',
  durationSeconds: 0,
  durationText: '--',
  isLoading: false,
  error: null,
  isEstimated: false,
};

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Hook para calcular distância e tempo até uma parada em tempo real
 *
 * MIGRADO PARA OSRM (Open Source Routing Machine)
 * - Custo: GRATUITO (vs ~R$900/mês do Google Routes API)
 * - Cache: 5 minutos (gerenciado pelo serviço OSRM)
 * - Rate limit: 1 req/segundo (gerenciado pelo serviço OSRM)
 * - Fallback: Haversine se OSRM falhar
 *
 * @see src/lib/osrm.ts
 */
export function useDistanceToStop(
  userLocation: Location | null | undefined,
  destination: Location | null | undefined,
  options?: {
    enabled?: boolean;
    refreshInterval?: number; // ms entre atualizações (padrão: 2 minutos)
  }
): DistanceInfo {
  const { enabled = true, refreshInterval = INTERVALO_PADRAO_MS } = options || {};

  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo>(DISTANCIA_VAZIA);

  // O GPS entrega objeto novo a cada tick e o destino costuma ser recriado a cada
  // render do chamador. Como dependência de efeito isso refaria a consulta (e o
  // intervalo) o tempo todo: aqui só entram primitivos, e a posição viaja por ref.
  const locationRef = useRef(userLocation);
  locationRef.current = userLocation;
  const destRef = useRef(destination);
  destRef.current = destination;

  const lat = userLocation?.latitude;
  const lng = userLocation?.longitude;
  const destLat = destination?.latitude;
  const destLng = destination?.longitude;
  const temPosicao = lat != null && lng != null;
  const temDestino = destLat != null && destLng != null;
  const ativo = enabled && temPosicao && temDestino;

  const ultimaConsultaRef = useRef<{ em: number; lat: number; lng: number } | null>(null);
  const chaveDestinoRef = useRef<string | null>(null);
  const requisicaoRef = useRef(0);

  const consultar = (async () => {
    const origem = locationRef.current;
    const alvo = destRef.current;
    if (!origem || !alvo) return;

    ultimaConsultaRef.current = {
      em: Date.now(),
      lat: origem.latitude,
      lng: origem.longitude,
    };
    const minha = ++requisicaoRef.current;
    // Resposta atrasada de uma consulta antiga (outra parada) não pode vencer.
    const vigente = () => minha === requisicaoRef.current;

    setDistanceInfo(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await getDistance(origem, alvo);
      if (!vigente()) return;

      setDistanceInfo({
        distanceMeters: result.distance,
        distanceKm: result.distanceText,
        durationSeconds: result.duration,
        durationText: result.durationText,
        isLoading: false,
        error: null,
        // getDistance trata a falha internamente e devolve o fallback Haversine,
        // então a flag é a única forma de saber que o número é estimado.
        isEstimated: result.is_estimated === true,
      });
    } catch (error) {
      if (!vigente()) return;
      logger.error('Erro ao calcular distância com OSRM:', error);

      // Fallback: cálculo Haversine (gratuito, menos preciso)
      const estimate = estimateRouteDistance(origem, alvo);

      setDistanceInfo({
        distanceMeters: estimate.distance,
        distanceKm: estimate.distanceText,
        durationSeconds: estimate.duration,
        durationText: estimate.durationText,
        isLoading: false,
        error: null, // Não mostrar erro, Haversine funciona como fallback
        isEstimated: true,
      });
    }
  });

  // Troca de parada (ou desligar/ligar): esquece o valor e a janela da anterior
  // e consulta na hora. Sem isso a Início mostrava a distância da parada concluída.
  const chaveDestino = ativo ? `${destLat},${destLng}` : null;
  useEffect(() => {
    if (chaveDestinoRef.current !== chaveDestino) {
      chaveDestinoRef.current = chaveDestino;
      requisicaoRef.current++;
      ultimaConsultaRef.current = null;
      setDistanceInfo(DISTANCIA_VAZIA);
    }
    if (chaveDestino) consultar();
    // `consultar` lê tudo por ref: só a chave do destino deve disparar.
  }, [chaveDestino]);

  // Movimento: recalcula antes do intervalo se andou além do limiar. Se ainda
  // está dentro do intervalo mínimo, agenda para o fim dele (a posição pode não
  // mudar mais, e então nenhum efeito voltaria a olhar).
  useEffect(() => {
    const ultima = ultimaConsultaRef.current;
    if (!ativo || !ultima || lat == null || lng == null) return;
    if (calculateHaversineDistance(ultima.lat, ultima.lng, lat, lng) < LIMIAR_MOVIMENTO_METROS) return;
    const restante = INTERVALO_MINIMO_MOVIMENTO_MS - (Date.now() - ultima.em);
    if (restante <= 0) {
      consultar();
      return;
    }
    const id = setTimeout(consultar, restante);
    return () => clearTimeout(id);
  }, [lat, lng, ativo]);

  // Refresh periódico: um relógio só, que não reinicia a cada posição nova.
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(consultar, refreshInterval);
    return () => clearInterval(id);
  }, [ativo, refreshInterval]);

  return distanceInfo;
}
