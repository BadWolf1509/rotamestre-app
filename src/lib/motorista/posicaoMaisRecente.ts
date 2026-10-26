import type * as Location from 'expo-location';

/**
 * A leitura mais recente do lote entregue a uma task de localização (pelo
 * horário do GPS, sem depender da ordem do array).
 *
 * POR QUE SÓ ELA (e não todas). O sistema agrupa leituras (no iOS, a cada
 * 30 s / 100 m; no Android, com 50 m de intervalo, o lote quase sempre tem
 * uma). Gravar a primeira deixava o marcador do gestor, que segue o último
 * INSERT, atrás de onde o motorista já estava. Gravar todas daria um trajeto
 * mais fiel, mas multiplicaria INSERTs e linhas por entrega e mudaria a
 * contagem das conferências da rota (uma por posição gravada); um ponto a
 * cada ~100 m já desenha o trajeto.
 *
 * Usada pelas duas tasks (`unifiedLocationTracking` e `locationTracking`):
 * esta última pegava `locations[0]`, a mais ANTIGA do lote.
 */
export function maisRecente(
  locations: Location.LocationObject[] | undefined,
): Location.LocationObject | undefined {
  if (!locations?.length) return undefined;
  return locations.reduce((recente, atual) =>
    atual.timestamp > recente.timestamp ? atual : recente,
  );
}
