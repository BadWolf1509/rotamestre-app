/**
 * Rota no Google Maps para o fallback do mini-mapa web.
 *
 * Só o que falta fazer: paradas não concluídas e não puladas, com coordenada
 * válida e sem os checkpoints da unidade (partida/chegada, `is_checkpoint
 * === false`). Sem `origin`, o Google parte da localização de quem abre.
 * O link aceita poucos waypoints: abre só as próximas paradas, em sequência
 * (8 waypoints + destino), sem pular nenhuma do meio.
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

  // Janela contínua: as próximas pendentes na ordem, a última vira destino.
  // Destino = última pendente com waypoints = primeiras pularia as do meio.
  const janela = pendentes.slice(0, MAX_WAYPOINTS_GOOGLE_MAPS + 1);
  const destino = janela[janela.length - 1];
  if (!destino) return null;

  const waypoints = janela.slice(0, -1).map(ponto).join('%7C');

  return (
    `https://www.google.com/maps/dir/?api=1&destination=${ponto(destino)}` +
    (waypoints ? `&waypoints=${waypoints}` : '') +
    '&travelmode=driving'
  );
}
