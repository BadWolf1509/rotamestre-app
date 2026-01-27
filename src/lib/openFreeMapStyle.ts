import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type FilterExpression = any[] | boolean;

let cachedStyle: StyleSpecification | null = null;
let cachedStylePromise: Promise<StyleSpecification> | null = null;

function isGetExpression(value: unknown): value is ['get', string] {
  return Array.isArray(value) && value[0] === 'get' && typeof value[1] === 'string';
}

function extractNumericGetProps(filter: FilterExpression, props = new Set<string>()): Set<string> {
  if (!Array.isArray(filter)) return props;

  const [op, left, right] = filter;
  if (typeof op === 'string' && ['==', '!=', '>', '>=', '<', '<='].includes(op)) {
    if (isGetExpression(left) && typeof right === 'number') {
      props.add(left[1]);
    }
    if (isGetExpression(right) && typeof left === 'number') {
      props.add(right[1]);
    }
  }

  for (const child of filter.slice(1)) {
    extractNumericGetProps(child as FilterExpression, props);
  }

  return props;
}

function collectHasProps(filter: FilterExpression, props = new Set<string>()): Set<string> {
  if (!Array.isArray(filter)) return props;

  const [op, value] = filter;
  if (op === 'has' && typeof value === 'string') {
    props.add(value);
  }

  for (const child of filter.slice(1)) {
    collectHasProps(child as FilterExpression, props);
  }

  return props;
}

function patchFilter(filter: FilterExpression): FilterExpression {
  if (!Array.isArray(filter)) return filter;

  const numericProps = extractNumericGetProps(filter);
  if (numericProps.size === 0) return filter;

  const existingHas = collectHasProps(filter);
  const missingProps = [...numericProps].filter((prop) => !existingHas.has(prop));
  if (missingProps.length === 0) return filter;

  const hasClauses = missingProps.map((prop) => ['has', prop] as const);

  if (filter[0] === 'all') {
    return ['all', ...hasClauses, ...filter.slice(1)];
  }

  return ['all', ...hasClauses, filter];
}

function patchStyle(style: StyleSpecification): StyleSpecification {
  if (!style || !Array.isArray(style.layers)) {
    return style;
  }

  const layers = style.layers.map((layer) => {
    // Not all layer types have filter property - use type guard
    const layerWithFilter = layer as { filter?: FilterExpression };
    if (!layerWithFilter.filter) return layer;

    const patchedFilter = patchFilter(layerWithFilter.filter);
    if (patchedFilter === layerWithFilter.filter) return layer;

    return { ...layer, filter: patchedFilter };
  });

  // Type assertion needed because we're modifying filter types
  return { ...style, layers } as StyleSpecification;
}

export async function getOpenFreeMapStyle(): Promise<StyleSpecification> {
  if (cachedStyle) return cachedStyle;

  if (!cachedStylePromise) {
    cachedStylePromise = fetch(OPENFREEMAP_STYLE_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`OpenFreeMap style error: ${response.status}`);
        }
        return response.json();
      })
      .then((style: StyleSpecification) => {
        cachedStyle = patchStyle(style);
        return cachedStyle;
      })
      .catch((error) => {
        cachedStylePromise = null;
        throw error;
      });
  }

  return cachedStylePromise;
}

export { OPENFREEMAP_STYLE_URL };

type StyleImageMissingEvent = {
  id: string;
};

export function installOpenFreeMapMissingImageHandler(map: MapLibreMap): () => void {
  const handleMissingImage = (event: StyleImageMissingEvent) => {
    if (map.hasImage(event.id)) return;
    map.addImage(event.id, {
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0]),
    });
  };

  map.on('styleimagemissing', handleMissingImage);

  return () => {
    map.off('styleimagemissing', handleMissingImage);
  };
}
