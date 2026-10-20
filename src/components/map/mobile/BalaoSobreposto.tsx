/**
 * Balão desenhado SOBRE o mapa nativo, fora de qualquer <Marker>.
 *
 * POR QUE. No Android, cada Marker é uma view filha do MapView na ordem de
 * criação: o último é desenhado por cima, mas o hit-test
 * (`MarkerViewManager.findMarkerAtPoint`) devolve o PRIMEIRO que contém o
 * ponto. Com o balão dentro do Marker, o balão de um pino ficava por baixo dos
 * pinos criados depois, e nenhuma ordem acerta desenho e toque juntos. Fora
 * do Marker, o balão é uma View comum: fica por cima de tudo e recebe toque.
 *
 * Posição: `ponto` é o pé do pino em dp (de `mapRef.project`); o balão mede o
 * próprio tamanho e se põe centrado acima do pino, sem sair da área do mapa
 * pelas laterais. Pino fora da área visível: sem balão.
 */

import React, { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { mapMobileStyles as styles } from '@/components/map/mobile/styles';

/** Distância das bordas laterais do mapa (dp). */
const MARGEM = 8;
/** Espaço entre o topo do pino e o balão (dp). */
const VAO = 8;

interface BalaoSobrepostoProps {
  /** Pé do pino na tela (dp); null enquanto a câmera se move. */
  ponto: [number, number] | null;
  /** Tamanho da área do mapa (dp); null antes do primeiro layout. */
  area: { largura: number; altura: number } | null;
  /** Altura do pino (dp): o balão fica acima dela. */
  alturaDoPino: number;
  children: ReactNode;
}

export function BalaoSobreposto({
  ponto,
  area,
  alturaDoPino,
  children,
}: BalaoSobrepostoProps) {
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null);

  if (!ponto || !area) return null;
  const [x, y] = ponto;
  if (x < 0 || x > area.largura || y < 0 || y > area.altura) return null;

  // Antes de medir, desenha invisível para obter o tamanho.
  const posicao = tamanho
    ? {
        left: Math.max(
          MARGEM,
          Math.min(x - tamanho.w / 2, area.largura - tamanho.w - MARGEM),
        ),
        top: y - alturaDoPino - VAO - tamanho.h,
      }
    : { left: 0, top: 0, opacity: 0 };

  return (
    <View
      testID="mapa-balao"
      style={[styles.balaoSobreposto, posicao]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (tamanho?.w !== width || tamanho?.h !== height) {
          setTamanho({ w: width, h: height });
        }
      }}
    >
      {children}
    </View>
  );
}
