/**
 * NavigationInfoPanel – botões com a fonte do sistema ampliada
 *
 * Com a fonte do sistema em 2.0 (moto g15, teste de rua da 1.12.9), "Concluir"
 * encostava na borda do botão. O CI não aplica escala de fonte, então o teste
 * fixa as props que seguram o rótulo numa linha e o respiro lateral — as
 * mesmas que "Abrir no Google Maps" já tinha desde o #579.
 */

import { render, within } from '@testing-library/react-native';
import React from 'react';
import { Animated, StyleSheet } from 'react-native';

import type { ParadaData } from '@/context/RouteStatusContext';

import { NavigationInfoPanel } from '../NavigationInfoPanel';

const parada = {
  id: 'p1',
  ordem: 1,
  endereco: 'Rua A, 1',
  latitude: -23.5,
  longitude: -46.6,
  status: 'pendente',
  tipo: 'entrega',
  is_checkpoint: true,
} as unknown as ParadaData;

function renderizar() {
  return render(
    <NavigationInfoPanel
      currentStop={parada}
      nextStop={null}
      realParadas={[parada]}
      currentStopIndex={0}
      distance={120}
      eta="2 min"
      speed={0}
      isEntrega
      preferences={{} as never}
      pulseAnim={new Animated.Value(1)}
      buttonScaleAnims={{
        skip: new Animated.Value(1),
        maps: new Animated.Value(1),
        complete: new Animated.Value(1),
      }}
      formatDistance={(m) => `${m} m`}
      getSpeedColor={() => '#000'}
      onAnimateButtonPress={jest.fn()}
      onComplete={jest.fn()}
      onSkip={jest.fn()}
      onOpenInMaps={jest.fn()}
      rotuloAppExterno="Abrir no Google Maps"
    />,
  );
}

describe('NavigationInfoPanel – botões de ação', () => {
  it.each(['Pular', 'Concluir', 'Abrir no Google Maps'])(
    '"%s" fica numa linha e encolhe ao lado do ícone',
    (rotulo) => {
      const texto = renderizar().getByText(rotulo);

      expect(texto.props.numberOfLines).toBe(1);
      expect(StyleSheet.flatten(texto.props.style).flexShrink).toBe(1);
    },
  );

  // A 360 dp, três botões numa linha davam ~60 dp de texto a cada um: com a
  // fonte do sistema em 2.0, "Concluir" virava "Con…". O Concluir — a ação
  // que importa — ganha a linha inteira; Pular e o app externo dividem a de
  // baixo.
  it('Concluir ocupa a própria linha; Pular e o app externo ficam na de baixo', () => {
    const tela = renderizar();
    const secundarias = within(tela.getByTestId('acoes-navegacao-secundarias'));

    expect(secundarias.getByText('Pular')).toBeTruthy();
    expect(secundarias.getByText('Abrir no Google Maps')).toBeTruthy();
    expect(secundarias.queryByText('Concluir')).toBeNull();
    expect(tela.getByText('Concluir')).toBeTruthy();
  });

  it('o botão tem respiro lateral, para o rótulo não encostar na borda', () => {
    const texto = renderizar().getByText('Concluir');
    const botao = texto.parent?.parent;
    const estilo = StyleSheet.flatten(botao?.props.style);

    expect(estilo.paddingHorizontal).toBeGreaterThan(0);
  });
});

// A partida (tipo 'origem') caía no ternário Entrega/Retirada e aparecia como
// "Retirada" no painel.
describe('NavigationInfoPanel – rótulo do tipo', () => {
  function renderizarTipo(tipo: string) {
    const p = { ...parada, tipo } as ParadaData;
    return render(
      <NavigationInfoPanel
        currentStop={p}
        nextStop={null}
        realParadas={[p]}
        currentStopIndex={0}
        distance={120}
        eta="2 min"
        speed={0}
        isEntrega={tipo === 'entrega'}
        preferences={{} as never}
        pulseAnim={new Animated.Value(1)}
        buttonScaleAnims={{
          skip: new Animated.Value(1),
          maps: new Animated.Value(1),
          complete: new Animated.Value(1),
        }}
        formatDistance={(m) => `${m} m`}
        getSpeedColor={() => '#000'}
        onAnimateButtonPress={jest.fn()}
        onComplete={jest.fn()}
        onSkip={jest.fn()}
        onOpenInMaps={jest.fn()}
        rotuloAppExterno="Abrir no Google Maps"
      />,
    );
  }

  it('origem não aparece como "Retirada"', () => {
    const { getByText, queryByText } = renderizarTipo('origem');

    expect(getByText('Parada')).toBeTruthy();
    expect(queryByText('Retirada')).toBeNull();
  });

  it('retirada continua "Retirada"', () => {
    expect(renderizarTipo('retirada').getByText('Retirada')).toBeTruthy();
  });
});
