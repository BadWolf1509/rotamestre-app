/**
 * Types for IncidentReportWizard components
 */

import type { Theme } from '@/utils/styles';

import type { Ionicons } from '@expo/vector-icons';

// Tipo para chaves de cores de incidente no tema
export type IncidentColorKey = keyof Theme['colors']['incident'];

export interface IncidentCategory {
  value: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorKey: IncidentColorKey;
}

export interface IncidentReport {
  category: string;
  description: string;
  photoUri?: string;
  paradaId?: string;
  rotaId?: string;
  motoristaId: string;
  endereco?: string;
  timestamp: string;
}

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  { value: 'accident', label: 'Acidente/Incidente', icon: 'warning', colorKey: 'accident' },
  { value: 'absent', label: 'Cliente ausente', icon: 'home-outline', colorKey: 'absent' },
  { value: 'wrong_address', label: 'Endereço incorreto', icon: 'location-outline', colorKey: 'wrongAddress' },
  { value: 'blocked', label: 'Acesso bloqueado', icon: 'lock-closed-outline', colorKey: 'blocked' },
  { value: 'vehicle_issue', label: 'Problema no veículo', icon: 'car-outline', colorKey: 'vehicle' },
  { value: 'weather', label: 'Condições climáticas', icon: 'rainy-outline', colorKey: 'weather' },
  { value: 'other', label: 'Outro problema', icon: 'help-circle-outline', colorKey: 'other' },
];

export const getIncidentColor = (theme: Theme, colorKey: IncidentColorKey): string => {
  return theme.colors.incident[colorKey];
};
