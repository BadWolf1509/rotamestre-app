/**
 * Polyline Utilities
 *
 * Funções para codificar e decodificar polylines do Google Maps.
 * Baseado no algoritmo oficial:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * @module polyline
 */

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/**
 * Decodifica uma polyline encoded do Google para array de coordenadas.
 *
 * @param encoded - String encoded no formato Google Polyline
 * @returns Array de coordenadas {latitude, longitude}
 *
 * @example
 * const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
 * // [{latitude: 38.5, longitude: -120.2}, ...]
 */
export function decodePolyline(encoded: string): Coordenadas[] {
  const points: Coordenadas[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Codifica um número para o formato polyline.
 * Função auxiliar interna.
 */
function encodeNumber(num: number): string {
  let encoded = '';
  let value = num < 0 ? ~(num << 1) : num << 1;

  while (value >= 0x20) {
    encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }

  encoded += String.fromCharCode(value + 63);
  return encoded;
}

/**
 * Codifica um array de coordenadas em polyline encoded.
 *
 * @param points - Array de coordenadas {latitude, longitude}
 * @returns String encoded no formato Google Polyline
 *
 * @example
 * const encoded = encodePolyline([
 *   {latitude: 38.5, longitude: -120.2},
 *   {latitude: 40.7, longitude: -120.95}
 * ]);
 */
export function encodePolyline(points: Coordenadas[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.latitude * 1e5);
    const lng = Math.round(point.longitude * 1e5);

    encoded += encodeNumber(lat - prevLat);
    encoded += encodeNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Combina múltiplas polylines em uma única polyline válida.
 * Decodifica cada uma, concatena os pontos (removendo duplicatas) e recodifica.
 *
 * @param polylines - Array de strings encoded
 * @returns String encoded única combinando todas as polylines
 *
 * @example
 * const merged = mergePolylines([polyline1, polyline2, polyline3]);
 */
export function mergePolylines(polylines: string[]): string {
  const allPoints: Coordenadas[] = [];

  for (const polyline of polylines) {
    if (!polyline) continue;

    const points = decodePolyline(polyline);

    // Se já temos pontos, verificar se precisa remover duplicata
    if (allPoints.length > 0 && points.length > 0) {
      const lastPoint = allPoints[allPoints.length - 1];
      const firstPoint = points[0];

      // Se o último ponto é muito próximo do primeiro (~11 metros), remover duplicata
      const distance = Math.sqrt(
        Math.pow(lastPoint.latitude - firstPoint.latitude, 2) +
        Math.pow(lastPoint.longitude - firstPoint.longitude, 2)
      );

      if (distance < 0.0001) {
        points.shift(); // Remove primeiro ponto duplicado
      }
    }

    allPoints.push(...points);
  }

  return encodePolyline(allPoints);
}
