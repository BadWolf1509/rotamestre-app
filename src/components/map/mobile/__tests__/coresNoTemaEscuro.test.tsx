/**
 * Mapa nativo do gestor no tema escuro (B-UI-1 / R-UI-3).
 *
 * O estilo do mapa é sempre claro, mas `colors.white`/`surface` se INVERTEM no
 * tema escuro. Pino, número, ícone do checkpoint e linha da rota são desenho
 * sobre o mapa e usam a paleta clara fixa; o BALÃO é cartão de interface e
 * segue o tema.
 *
 * Arquivo à parte porque o `StyleSheet.create` é avaliado na importação, com
 * o tema do mock (modelo: MiniMap.temaEscuro.test.tsx).
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import {
  CORES_DE_STATUS_SOBRE_O_MAPA,
  CORES_SOBRE_O_MAPA,
} from '@/components/map/coresSobreOMapa';
import { PinoDaUnidade } from '@/components/map/PinoDaUnidade';
import { pontosDaUnidade } from '@/components/map/pontosDaUnidade';
import { darkTheme } from '@/utils/styles.base';

import { ParadaMarker } from '../markers/ParadaMarker';
import { mapMobileStyles } from '../styles';

jest.mock('@/utils/styles', () => {
  const { darkTheme: escuro } = jest.requireActual('@/utils/styles.base');
  return {
    useUnistyles: () => ({ theme: escuro }),
    StyleSheet: {
      create: (fn: unknown) => (typeof fn === 'function' ? fn(escuro) : fn),
    },
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

const parada = {
  id: 'p1',
  ordem: 3,
  endereco: 'Rua A, 1',
  latitude: -23.5,
  longitude: -46.6,
  status: 'em_andamento',
  tipo: 'entrega',
} as never;

describe('mapa nativo do gestor no tema escuro', () => {
  it('pino da parada: borda, número e sombra da paleta clara', () => {
    const { getByLabelText } = render(
      <ParadaMarker parada={parada} isSelected={false} />,
    );
    const pino = StyleSheet.flatten(
      getByLabelText(/Parada 3/).props.style,
    ) as Record<string, unknown>;
    expect(pino.borderColor).toBe(CORES_SOBRE_O_MAPA.branco);
    expect(pino.shadowColor).toBe(CORES_SOBRE_O_MAPA.sombra);
    // Preenchimento por status: variante da paleta clara (primary claro).
    expect(pino.backgroundColor).toBe(CORES_DE_STATUS_SOBRE_O_MAPA.primary);
    expect(mapMobileStyles.markerText.color).toBe(CORES_SOBRE_O_MAPA.branco);
    expect(mapMobileStyles.markerText.color).not.toBe(darkTheme.colors.surface);
  });

  it('pino selecionado: contorno na cor da marca clara', () => {
    expect(mapMobileStyles.markerSelected.borderColor).toBe(
      CORES_SOBRE_O_MAPA.marca,
    );
  });

  it('pino da sede: fundo, borda e ícone da paleta clara', () => {
    const [sede] = pontosDaUnidade([
      {
        id: 'p0',
        ordem: 0,
        latitude: -7.1,
        longitude: -34.8,
        endereco: 'Rua B, 2',
      },
      {
        id: 'c9',
        ordem: 9,
        latitude: -7.1,
        longitude: -34.8,
        endereco: 'Rua B, 2',
      },
    ]);
    const { getByLabelText, UNSAFE_getByType } = render(
      <PinoDaUnidade ponto={sede} tamanho={28} />,
    );
    const pino = StyleSheet.flatten(
      getByLabelText(/Sede da unidade/).props.style,
    ) as Record<string, unknown>;
    expect(pino.backgroundColor).toBe(CORES_SOBRE_O_MAPA.sede);
    expect(pino.borderColor).toBe(CORES_SOBRE_O_MAPA.branco);
    expect(pino.shadowColor).toBe(CORES_SOBRE_O_MAPA.sombra);
    expect(UNSAFE_getByType('Ionicons' as never).props.color).toBe(
      CORES_SOBRE_O_MAPA.branco,
    );
  });

  // O selo repete o pino da unidade: mesma cor fixa, nos dois temas.
  it('selo do balão da unidade: azul-marinho do pino, não o primaryDark do escuro', () => {
    expect(mapMobileStyles.checkpointIconBadge.backgroundColor).toBe(
      CORES_SOBRE_O_MAPA.sede,
    );
  });

  it('o balão segue o tema (cartão de interface)', () => {
    expect(mapMobileStyles.calloutContainer.backgroundColor).toBe(
      darkTheme.colors.surface,
    );
    expect(mapMobileStyles.checkpointCalloutContainer.backgroundColor).toBe(
      darkTheme.colors.surface,
    );
  });
});
