type LatLng = {
  latitude: number;
  longitude: number;
};

type LngLatTuple = [number, number];

type GeoJSONLineString = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'LineString';
    coordinates: LngLatTuple[];
  };
};

type MapBounds = {
  ne: LngLatTuple;
  sw: LngLatTuple;
};

/**
 * Fonte de tiles do app — web e nativo. Fonte unica: o web importa esta
 * constante em `src/lib/openFreeMapStyle.ts`, o nativo passa direto no
 * `mapStyle`.
 *
 * Antes daqui saia um raster da Carto (`basemaps.cartocdn.com/rastertiles/
 * voyager`) sem chave, so no nativo — o web ja usava OpenFreeMap. Em 31/08/2026
 * a Carto passou a exigir API key: o endpoint responde 200, mas com tiles
 * marcados "API KEY REQUIRED", que chegavam ao motorista. Nada quebrava, nada
 * falhava — so aparecia errado na tela.
 *
 * Chave da Carto foi descartada como saida: ela teria de viajar no bundle do
 * app, de onde e extraivel. O padrao do projeto e chave server-side (a do
 * Google Places vive nos secrets das Edge Functions), e uma fonte sem chave
 * dispensa o problema.
 *
 * O nativo recebe a URL crua porque o `mapStyle` do
 * `@maplibre/maplibre-react-native` aceita `string | StyleSpecification` e o SDK
 * busca e interpreta o estilo sozinho. O web nao pode: precisa do
 * `getOpenFreeMapStyle()`, que baixa o JSON e corrige filtros que o maplibre-gl
 * rejeita. Esse patch e especifico do maplibre-gl e nao se aplica ao nativo.
 */
export const OPENFREEMAP_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty';

export function toLngLat({ latitude, longitude }: LatLng): LngLatTuple {
  return [longitude, latitude];
}

export function toLineString(coords: LatLng[]): GeoJSONLineString {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords.map(toLngLat),
    },
  };
}

export function getBounds(coords: LatLng[]): MapBounds | null {
  if (!coords.length) return null;

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  coords.forEach((coord) => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}

export function zoomFromLongitudeDelta(delta: number): number {
  if (!delta || delta <= 0) return 14;
  const zoom = Math.log2(360 / delta);
  return Math.max(1, Math.min(20, zoom));
}

export type { LatLng, LngLatTuple, MapBounds, GeoJSONLineString };
