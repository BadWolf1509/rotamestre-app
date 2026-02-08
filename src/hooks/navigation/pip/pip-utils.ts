/**
 * PiP Map - Pure utility functions
 *
 * Extracted from PictureInPictureMap.web.tsx for testability.
 * These are pure calculation functions with no side effects.
 */

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate map center point between user and destination.
 * Falls back to São Paulo if no locations provided.
 */
export function getMapCenter(
  userLocation?: Location | null,
  destination?: Location | null
): { lng: number; lat: number } {
  if (userLocation && destination) {
    const minLat = Math.min(userLocation.latitude, destination.latitude);
    const maxLat = Math.max(userLocation.latitude, destination.latitude);
    const minLon = Math.min(userLocation.longitude, destination.longitude);
    const maxLon = Math.max(userLocation.longitude, destination.longitude);

    return {
      lng: (minLon + maxLon) / 2,
      lat: (minLat + maxLat) / 2,
    };
  }

  if (userLocation) {
    return { lng: userLocation.longitude, lat: userLocation.latitude };
  }

  if (destination) {
    return { lng: destination.longitude, lat: destination.latitude };
  }

  return { lng: -46.6333, lat: -23.5505 }; // São Paulo default
}

/**
 * Calculate appropriate zoom level based on distance between points.
 */
export function getMapZoom(
  userLocation?: Location | null,
  destination?: Location | null
): number {
  if (userLocation && destination) {
    const latDiff = Math.abs(userLocation.latitude - destination.latitude);
    const lngDiff = Math.abs(userLocation.longitude - destination.longitude);
    const maxDiff = Math.max(latDiff, lngDiff);

    if (maxDiff > 0.1) return 12;
    if (maxDiff > 0.05) return 13;
    if (maxDiff > 0.02) return 14;
    return 15;
  }
  return 15;
}

/**
 * Build Google Maps directions URL for external navigation.
 */
export function buildGoogleMapsUrl(
  destination: Location,
  userLocation?: Location | null
): string {
  const origin = userLocation
    ? `${userLocation.latitude},${userLocation.longitude}`
    : '';

  const dest = `${destination.latitude},${destination.longitude}`;
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ''}&destination=${dest}&travelmode=driving`;
}
