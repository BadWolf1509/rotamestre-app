/**
 * FloatingActionButtons component for MapaMobile
 *
 * Renders the map control FABs: fit-all, center-on-user, and navigate-to-next-stop.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';

import { mapMobileStyles as styles } from '@/components/map/mobile/styles';
import type { ParadaMapItem as Parada } from '@/types/parada-map';
import { useUnistyles } from '@/utils/styles';

interface FloatingActionButtonsProps {
  onFitAll: () => void;
  onCenterOnUser: () => void;
  isLocating: boolean;
  proximaParadaPendente: Parada | undefined;
  onNavigate: () => void;
}

/**
 * Floating action buttons for map controls.
 * Shows fit-all, center-on-user, and (when applicable) navigate-to-next-stop buttons.
 */
export function FloatingActionButtons({
  onFitAll,
  onCenterOnUser,
  isLocating,
  proximaParadaPendente,
  onNavigate,
}: FloatingActionButtonsProps) {
  const { theme } = useUnistyles();

  return (
    <View
      style={styles.fabContainer}
      accessibilityRole="toolbar"
      accessibilityLabel="Controles do mapa"
    >
      {/* Botão de ajustar para mostrar todas as paradas */}
      <TouchableOpacity
        style={styles.fabSecondary}
        onPress={onFitAll}
        activeOpacity={0.8}
        accessible={true}
        accessibilityLabel="Ajustar mapa para mostrar todas as paradas"
        accessibilityRole="button"
      >
        <Ionicons name="scan-outline" size={22} color={theme.colors.primary} />
      </TouchableOpacity>

      {/* Botão de centralizar no usuário */}
      <TouchableOpacity
        style={styles.fabSecondary}
        onPress={onCenterOnUser}
        activeOpacity={0.8}
        disabled={isLocating}
        accessible={true}
        accessibilityLabel={
          isLocating
            ? 'Obtendo localização'
            : 'Centralizar mapa na minha localização'
        }
        accessibilityRole="button"
        accessibilityState={{ busy: isLocating, disabled: isLocating }}
      >
        {isLocating ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons name="locate" size={22} color={theme.colors.primary} />
        )}
      </TouchableOpacity>

      {/* Botão principal de navegação */}
      {proximaParadaPendente && (
        <TouchableOpacity
          style={styles.fabPrimary}
          onPress={onNavigate}
          activeOpacity={0.8}
          accessible={true}
          accessibilityLabel={`Navegar para parada ${proximaParadaPendente.ordem}`}
          accessibilityRole="button"
          accessibilityHint="Abre aplicativo de navegação"
        >
          <Ionicons name="navigate" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}
