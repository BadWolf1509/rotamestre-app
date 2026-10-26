/**
 * Dono único da transmissão de posição em primeiro plano do motorista.
 *
 * Montado uma vez no layout do motorista, dentro do `RouteStatusProvider`.
 * Antes cada aba (Início, Paradas, Mapa) chamava o hook, e como as abas ficam
 * montadas depois de visitadas, eram até três watchers de GPS gravando a
 * mesma posição. Alternativa descartada: deduplicar dentro do hook (contador
 * de módulo) — esconde o problema e mantém três assinaturas de GPS vivas.
 * Guarda: `app/motorista/__tests__/transmissao-de-posicao-unica.test.ts`.
 */
import { useRouteStatus } from '@/context/RouteStatusContext';
import { useDriverLocationBroadcast } from '@/hooks/useDriverLocationBroadcast';

export function TransmissaoDePosicao(): null {
  const { route } = useRouteStatus();
  useDriverLocationBroadcast({
    rotaId: route?.id,
    rotaStatus: route?.status,
  });
  return null;
}
