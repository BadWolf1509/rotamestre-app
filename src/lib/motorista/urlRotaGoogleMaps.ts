/**
 * Rota no Google Maps para o fallback do mini-mapa web.
 *
 * Só o que falta fazer: paradas não concluídas e não puladas, com coordenada
 * válida e sem os checkpoints da unidade (partida/chegada, `is_checkpoint
 * === false`). Sem `origin`, o Google parte da localização de quem abre.
 * O link aceita poucos waypoints; ficam os mais próximos na ordem da rota.
 */

import { temCoordenadaValida } from './coordenadaValida';

export const MAX_WAYPOINTS_GOOGLE_MAPS = 8;

type ParadaDaRota = {
  ordem: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  is_checkpoint?: boolean;
};

const ponto = (p: ParadaDaRota) => `${p.latitude},${p.longitude}`;

/** `null` quando não há parada pendente com coordenada: não há rota a abrir. */
export function montarUrlRotaGoogleMaps(
  paradas: ParadaDaRota[],
): string | null {
  const pendentes = paradas
    .filter(
      (p) =>
        p.status !== 'concluida' &&
        p.status !== 'pulada' &&
        p.is_checkpoint !== false &&
        temCoordenadaValida(p),
    )
    .sort((a, b) => a.ordem - b.ordem);

  const destino = pendentes[pendentes.length - 1];
  if (!destino) return null;

  const waypoints = pendentes
    .slice(0, -1)
    .slice(0, MAX_WAYPOINTS_GOOGLE_MAPS)
    .map(ponto)
    .join('|');

  return (
    `https://www.google.com/maps/dir/?api=1&destination=${ponto(destino)}` +
    (waypoints ? `&waypoints=${waypoints}` : '') +
    '&travelmode=driving'
  );
}
