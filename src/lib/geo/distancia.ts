/**
 * Distância em linha reta entre dois pontos (fórmula de Haversine).
 *
 * Fonte única: o app tinha quatro cópias (OSRM fallback, geometria da rota,
 * ajudante da nova entrega e serviço de rastreamento). A guarda
 * `__tests__/haversine-fonte-unica.test.ts` impede que uma nova nasça.
 */

export interface PontoGeo {
  latitude: number;
  longitude: number;
}

/** Raio médio da Terra, em metros. */
export const RAIO_DA_TERRA_METROS = 6371000;

/** Distância em metros entre dois pontos dados em graus. */
export function distanciaMetrosEntre(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return RAIO_DA_TERRA_METROS * c;
}

/** Mesma distância, a partir de dois pontos `{ latitude, longitude }`. */
export function distanciaMetros(a: PontoGeo, b: PontoGeo): number {
  return distanciaMetrosEntre(a.latitude, a.longitude, b.latitude, b.longitude);
}
