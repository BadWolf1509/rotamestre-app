/**
 * MapaMobile.web.tsx - Stub para Web
 *
 * Este arquivo é usado automaticamente pelo Metro quando rodando na web.
 * O arquivo MapaMobile.tsx (sem .web) é usado apenas em plataformas nativas.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Parada {
  id: string;
  ordem: number;
  endereco: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

interface MapaMobileProps {
  paradas: Parada[];
}

/**
 * Componente stub para web
 * Na web, o MapaAdapter deve usar MapaWeb em vez deste componente.
 * Este arquivo existe apenas para evitar erros de bundling.
 */
export function MapaMobile({ paradas }: MapaMobileProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        ⚠️ MapaMobile não deve ser usado na web.{'\n'}
        Use MapaWeb através do MapaAdapter.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  container: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.warningLight,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: theme.colors.warning,
  },
  text: {
    fontSize: 14,
    color: theme.colors.warningDark,
    textAlign: 'center',
    fontWeight: '600',
  },
}));