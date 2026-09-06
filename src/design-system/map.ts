/**
 * Map Feature Components
 * @/design-system/map
 *
 * Note: Some components have platform-specific variants (.web.tsx)
 * Import paths resolve automatically based on platform.
 *
 * Migrated from Google Maps to free alternatives in Dec/2024:
 * - Web: MapLibre GL JS + OpenFreeMap tiles
 * - Mobile: MapLibre Native + OpenFreeMap tiles
 */

// Map Components
export { MapaAdapter } from '@/components/MapaAdapter';
export { MapaMobile } from '@/components/MapaMobile';
export { default as MapaWebMapLibre } from '@/components/MapaWebMapLibre';
export { MotoristaMarker } from '@/components/MotoristaMarker';
