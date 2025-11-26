declare module '@mapbox/polyline' {
  export function decode(str: string, precision?: number): [number, number][];
  export function encode(coordinates: [number, number][], precision?: number): string;
  export function fromGeoJSON(geojson: { coordinates: [number, number][] }, precision?: number): string;
  export function toGeoJSON(str: string, precision?: number): { type: 'LineString'; coordinates: [number, number][] };
}
