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

const CARTO_VOYAGER_RASTER_STYLE = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '(c) OpenStreetMap contributors (c) CARTO',
    },
  },
  layers: [
    {
      id: 'carto-voyager',
      type: 'raster',
      source: 'carto',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
} as const;

export const MAPLIBRE_RASTER_STYLE = CARTO_VOYAGER_RASTER_STYLE;
export const MAPLIBRE_RASTER_STYLE_JSON = JSON.stringify(
  CARTO_VOYAGER_RASTER_STYLE,
);

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
