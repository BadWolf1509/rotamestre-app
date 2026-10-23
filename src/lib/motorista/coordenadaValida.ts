/**
 * Coordenada que dá para pôr no mapa: número finito dentro do globo.
 *
 * Não use teste de verdade (`p.latitude && p.longitude`): zero numa das
 * coordenadas é válido e sairia como ausente. O par (0,0) exato, no golfo da
 * Guiné, é recusado: no Brasil é dado ruim (o repo fabrica `?? 0` quando a
 * coordenada falta). O dado chega do banco, então `null` em runtime é
 * possível mesmo com o tipo dizendo `number`.
 */
export function temCoordenadaValida(p: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const { latitude, longitude } = p;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}
