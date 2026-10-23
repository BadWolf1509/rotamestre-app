/**
 * Coordenada que dá para pôr no mapa: número finito dentro do globo.
 *
 * Não use teste de verdade (`p.latitude && p.longitude`): zero é coordenada
 * válida e sairia como ausente. O dado chega do banco, então `null` em
 * runtime é possível mesmo com o tipo dizendo `number`.
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
    longitude <= 180
  );
}
