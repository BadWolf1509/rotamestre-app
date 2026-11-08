/**
 * Pino da sede/partida/chegada nos mapas nativos (mapa do gestor e aba Mapa,
 * mini-mapa da Início e navegação). Quem decide o tipo é `pontosDaUnidade`;
 * a versão web é `criarElementoDoPinoDaUnidade`.
 *
 * Nada clicável aqui dentro: no Android o filho do `<Marker>` sai do Fabric e
 * o toque é tratado no `onPress` do próprio Marker.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { CORES_SOBRE_O_MAPA } from './coresSobreOMapa';
import {
  ESPEC_DO_PONTO,
  rotuloAcessivelDoPonto,
  type PontoComCoordenada,
  type PontoDaUnidade,
} from './pontosDaUnidade';

interface PinoDaUnidadeProps {
  ponto: PontoDaUnidade<PontoComCoordenada>;
  tamanho: number;
  testID?: string;
}

export function PinoDaUnidade({ ponto, tamanho, testID }: PinoDaUnidadeProps) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={rotuloAcessivelDoPonto(ponto)}
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.round(tamanho * 0.22),
        backgroundColor: CORES_SOBRE_O_MAPA.sede,
        borderWidth: 2,
        borderColor: CORES_SOBRE_O_MAPA.branco,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: CORES_SOBRE_O_MAPA.sombra,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
      }}
    >
      <Ionicons
        name={ESPEC_DO_PONTO[ponto.tipo].ionicon}
        size={Math.round(tamanho * 0.57)}
        color={CORES_SOBRE_O_MAPA.branco}
      />
    </View>
  );
}
