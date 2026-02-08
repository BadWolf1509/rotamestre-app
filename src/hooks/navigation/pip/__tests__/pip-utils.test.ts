import { getMapCenter, getMapZoom, buildGoogleMapsUrl } from '../pip-utils';

describe('pip-utils', () => {
  describe('getMapCenter', () => {
    it('returns center between user and destination', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.57, longitude: -46.65 };
      const center = getMapCenter(user, dest);

      expect(center.lat).toBeCloseTo(-23.56, 2);
      expect(center.lng).toBeCloseTo(-46.64, 2);
    });

    it('returns user location when no destination', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const center = getMapCenter(user, null);

      expect(center).toEqual({ lat: -23.55, lng: -46.63 });
    });

    it('returns destination when no user location', () => {
      const dest = { latitude: -23.57, longitude: -46.65 };
      const center = getMapCenter(null, dest);

      expect(center).toEqual({ lat: -23.57, lng: -46.65 });
    });

    it('returns São Paulo default when no locations', () => {
      const center = getMapCenter(null, null);

      expect(center).toEqual({ lng: -46.6333, lat: -23.5505 });
    });

    it('returns São Paulo default when both undefined', () => {
      const center = getMapCenter(undefined, undefined);

      expect(center).toEqual({ lng: -46.6333, lat: -23.5505 });
    });
  });

  describe('getMapZoom', () => {
    it('returns 12 for large distance (>0.1 degrees)', () => {
      const user = { latitude: -23.0, longitude: -46.0 };
      const dest = { latitude: -23.2, longitude: -46.2 };

      expect(getMapZoom(user, dest)).toBe(12);
    });

    it('returns 13 for medium distance (0.05-0.1)', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.62, longitude: -46.63 };

      expect(getMapZoom(user, dest)).toBe(13);
    });

    it('returns 14 for small distance (0.02-0.05)', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.58, longitude: -46.63 };

      expect(getMapZoom(user, dest)).toBe(14);
    });

    it('returns 15 for very close points (<0.02)', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.56, longitude: -46.63 };

      expect(getMapZoom(user, dest)).toBe(15);
    });

    it('returns 15 when no destination', () => {
      expect(getMapZoom({ latitude: -23.55, longitude: -46.63 }, null)).toBe(15);
    });

    it('returns 15 when no locations', () => {
      expect(getMapZoom(null, null)).toBe(15);
    });

    it('uses larger of lat/lng difference', () => {
      // lat diff = 0.01, lng diff = 0.15 → should use 0.15 → zoom 12
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.56, longitude: -46.78 };

      expect(getMapZoom(user, dest)).toBe(12);
    });
  });

  describe('buildGoogleMapsUrl', () => {
    it('builds URL with origin and destination', () => {
      const user = { latitude: -23.55, longitude: -46.63 };
      const dest = { latitude: -23.57, longitude: -46.65 };
      const url = buildGoogleMapsUrl(dest, user);

      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&origin=-23.55,-46.63&destination=-23.57,-46.65&travelmode=driving'
      );
    });

    it('builds URL without origin when no user location', () => {
      const dest = { latitude: -23.57, longitude: -46.65 };
      const url = buildGoogleMapsUrl(dest, null);

      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=-23.57,-46.65&travelmode=driving'
      );
    });

    it('builds URL without origin when user undefined', () => {
      const dest = { latitude: -23.57, longitude: -46.65 };
      const url = buildGoogleMapsUrl(dest);

      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&destination=-23.57,-46.65&travelmode=driving'
      );
    });
  });
});
