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
 * do intervalo: 30% da distância restante, entre um piso e um teto.
 *
 * Alternativas comparadas:
 * - Limiar fixo de 500 m: a 300 m da parada o card ficava em "300 m" por até
 *   2 min com o motorista já na porta (erro maior que a própria distância).
 * - Faixas (500 m / 200 m / 50 m por distância): resolve, mas tem degraus e
 *   três números para manter.
 * - Proporcional (escolhido): contínuo, com um só parâmetro. Longe (>1,7 km)
 *   vale o teto de 500 m (~45 s a 40 km/h); a 300 m vale 90 m; o piso de 50 m
 *   fica acima do ruído do GPS. Quem segura o ritmo de consultas é o mínimo de
 *   30 s, não o limiar.
 */
const FRACAO_LIMIAR_MOVIMENTO = 0.3;
const LIMIAR_MOVIMENTO_MIN_METROS = 50;
const LIMIAR_MOVIMENTO_MAX_METROS = 500;

function limiarDeMovimento(distanciaRestanteMetros: number): number {
  return Math.min(
    LIMIAR_MOVIMENTO_MAX_METROS,
    Math.max(LIMIAR_MOVIMENTO_MIN_METROS, FRACAO_LIMIAR_MOVIMENTO * distanciaRestanteMetros),
  );
}

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

  const ultimaConsultaRef = useRef<{ em: number; lat: number; lng: number; restante: number } | null>(null);
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
      // linha reta até o destino: base do limiar (a viária pode nem ter chegado)
      restante: calculateHaversineDistance(
        origem.latitude,
        origem.longitude,
        alvo.latitude,
        alvo.longitude,
      ),
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
  // Só destino e `enabled` entram na chave: perda momentânea de GPS na mesma
  // parada mantém o valor em vez de piscar "--".
  const chaveDestino = enabled && temDestino ? `${destLat},${destLng}` : null;
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

  // Desmontou: consulta em voo não pode mais gravar estado.
  useEffect(
    () => () => {
      requisicaoRef.current++;
    },
    [],
  );

  // Movimento: recalcula antes do intervalo se andou além do limiar. Se ainda
  // está dentro do intervalo mínimo, agenda para o fim dele (a posição pode não
  // mudar mais, e então nenhum efeito voltaria a olhar).
  useEffect(() => {
    if (!ativo || lat == null || lng == null) return;
    const ultima = ultimaConsultaRef.current;
    if (!ultima) {
      // GPS chegou depois do destino: primeira consulta
      consultar();
      return;
    }
    const andou = calculateHaversineDistance(ultima.lat, ultima.lng, lat, lng);
    if (andou < limiarDeMovimento(ultima.restante)) return;
    const restante = INTERVALO_MINIMO_MOVIMENTO_MS - (Date.now() - ultima.em);
    if (restante <= 0) {
      consultar();
      return;
    }
    const id = setTimeout(consultar, restante);
    return () => clearTimeout(id);
  }, [lat, lng, ativo, chaveDestino]);

  // Refresh periódico: um relógio só, que não reinicia a cada posição nova.
  // Uma consulta por movimento "reinicia" o relógio: a rodada que cair logo
  // depois dela é pulada.
  useEffect(() => {
    if (!ativo) return;
    const folga = Math.min(INTERVALO_MINIMO_MOVIMENTO_MS, refreshInterval);
    const id = setInterval(() => {
      const ultima = ultimaConsultaRef.current;
      if (ultima && Date.now() - ultima.em < folga) return;
      consultar();
    }, refreshInterval);
    return () => clearInterval(id);
  }, [ativo, refreshInterval]);

  return distanceInfo;
}
