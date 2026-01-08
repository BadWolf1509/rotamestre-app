/**
 * Types for RouteTimeline components
 */

import type { Ionicons } from '@expo/vector-icons';

export type EventType = 'status_change' | 'parada_update' | 'incidente' | 'gps_update';
export type FilterType = 'todos' | 'status' | 'paradas' | 'incidentes';

export interface TimelineEvent {
  id: string;
  type: EventType;
  timestamp: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  hasPhoto?: boolean;
  photoUrl?: string;
  isCritical?: boolean;
  fullDescription?: string;
  isNew?: boolean;
  isUnseen?: boolean;
}

export interface FilterOption {
  key: FilterType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const FILTER_OPTIONS: FilterOption[] = [
  { key: 'todos', label: 'Todos', icon: 'list' },
  { key: 'status', label: 'Status', icon: 'flag' },
  { key: 'paradas', label: 'Paradas', icon: 'location' },
  { key: 'incidentes', label: 'Incidentes', icon: 'alert-circle' },
];

export const DESCRIPTION_TRUNCATE_LENGTH = 80;
export const PAGE_SIZE = 50;
