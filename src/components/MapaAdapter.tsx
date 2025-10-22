/**
 * MapaAdapter - Wrapper Inteligente para Mapa
 *
 * Detecta automaticamente a plataforma e renderiza o componente apropriado:
 * - Web: MapaWeb (Google Maps JavaScript API)
 * - Mobile (Dev Build/Produção): MapaMobile (react-native-maps)
 * - Mobile (Expo Go): Fallback para lista (opcional)
 */

import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import MapaWeb from './MapaWeb';
import { MapaMobile } from './MapaMobile'; // Metro automaticamente usa MapaMobile.web.tsx na web

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  tipo?: string;
}

interface MapaAdapterProps {
  paradas: Parada[];
}

/**
 * Componente principal que adapta o mapa para cada plataforma
 */
export function MapaAdapter({ paradas }: MapaAdapterProps) {
  // Web: Usa MapaWeb (Google Maps JavaScript)
  if (Platform.OS === 'web') {
    return <MapaWeb paradas={paradas} />;
  }

  // Mobile: Usa MapaMobile (react-native-maps)
  // Metro automaticamente resolve para:
  // - Web: MapaMobile.web.tsx (stub sem react-native-maps)
  // - Native: MapaMobile.tsx (com react-native-maps completo)
  // Funciona em:
  // - Development Build (npx expo run:ios/android)
  // - Production Build (EAS Build)
  return <MapaMobile paradas={paradas} />;
}

/**
 * Componente de Fallback para desenvolvimento no Expo Go
 * (Opcional - usar apenas se MapaMobile não funcionar)
 */
export function MapaFallback({ paradas }: MapaAdapterProps) {
  const paradasComCoord = paradas.filter(p => p.latitude && p.longitude);

  return (
    <View style={styles.fallbackContainer}>
      <View style={styles.fallbackHeader}>
        <Text style={styles.fallbackTitle}>🗺️ Mapa não disponível no Expo Go</Text>
        <Text style={styles.fallbackSubtitle}>
          Para ver o mapa, faça um development build:
        </Text>
        <Text style={styles.fallbackCommand}>npx expo run:ios</Text>
        <Text style={styles.fallbackCommand}>npx expo run:android</Text>
      </View>

      <View style={styles.fallbackDivider} />

      <View style={styles.fallbackParadas}>
        <Text style={styles.fallbackListTitle}>
          📍 {paradasComCoord.length} Parada{paradasComCoord.length > 1 ? 's' : ''}:
        </Text>
        {paradasComCoord.map((parada, index) => (
          <View key={parada.id} style={styles.fallbackParadaItem}>
            <View style={[
              styles.fallbackParadaBadge,
              { backgroundColor: getStatusColor(parada.status) }
            ]}>
              <Text style={styles.fallbackParadaBadgeText}>{parada.ordem}</Text>
            </View>
            <View style={styles.fallbackParadaInfo}>
              <Text style={styles.fallbackParadaEndereco}>{parada.endereco}</Text>
              <Text style={styles.fallbackParadaCoords}>
                {parada.latitude?.toFixed(6)}, {parada.longitude?.toFixed(6)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Helper para cor do status
function getStatusColor(status: string): string {
  switch (status) {
    case 'concluida':
      return '#10b981';
    case 'em_andamento':
      return '#3b82f6';
    case 'pendente':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

const styles = StyleSheet.create({
  fallbackContainer: {
    height: 400,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fallbackHeader: {
    alignItems: 'center',
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  fallbackSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  fallbackCommand: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#0D5A9C',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  fallbackDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 16,
  },
  fallbackParadas: {
    flex: 1,
  },
  fallbackListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  fallbackParadaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fallbackParadaBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fallbackParadaBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fallbackParadaInfo: {
    flex: 1,
  },
  fallbackParadaEndereco: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 4,
  },
  fallbackParadaCoords: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
});
